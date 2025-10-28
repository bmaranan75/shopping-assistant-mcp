import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Dual Token Authentication for Enterprise MCP
 * 
 * Pattern:
 * 1. Client Credentials Token - Proves ChatGPT Enterprise is authorized to call MCP
 * 2. User OAuth2 Token - Provides user context for personalized operations
 * 
 * Headers:
 * - Authorization: Bearer <client_credentials_token>
 * - X-User-Token: Bearer <user_oauth2_token> (optional)
 * 
 * Supports:
 * - Auth0 (default)
 * - Okta OIE (set IDENTITY_PROVIDER=okta)
 */

// Determine JWKS endpoint based on identity provider
function getJwksUri(): string {
  const provider = process.env.IDENTITY_PROVIDER?.toLowerCase() || 'auth0';
  const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
  
  if (!issuerBaseUrl) {
    throw new Error('AUTH0_ISSUER_BASE_URL environment variable is required');
  }
  
  switch (provider) {
    case 'okta':
      // Okta OIE uses /v1/keys endpoint
      // Format: https://{org}.okta.com/oauth2/default/v1/keys
      return `${issuerBaseUrl}/v1/keys`;
    
    case 'auth0':
    default:
      // Auth0 uses standard OpenID Connect discovery
      // Format: https://{tenant}.{region}.auth0.com/.well-known/jwks.json
      return `${issuerBaseUrl}/.well-known/jwks.json`;
  }
}

// JWKS client for token verification (supports Auth0 and Okta OIE)
const jwksClient_ = jwksClient({
  jwksUri: getJwksUri(),
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

export interface AuthContext {
  // Client identity (from client credentials token)
  clientId: string;
  clientScopes: string[];
  
  // User identity (from user token, if provided)
  userId?: string;
  userEmail?: string;
  userName?: string;
  userToken?: string; // Raw token for downstream services (Auth0 CIBA)
  
  // Metadata
  authenticatedAt: Date;
  authMethod: 'dual-token' | 'client-only';
}

/**
 * Verify dual token authentication (Client Credentials + Optional User Token)
 * 
 * @param req - HTTP request with Authorization and optional X-User-Token headers
 * @returns AuthContext with client and optional user identity
 * @throws Error if authentication fails
 */
export async function verifyDualTokenAuth(req: Request): Promise<AuthContext> {
  // Step 1: Verify Client Credentials Token (required)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header. Expected: Bearer <client_credentials_token>');
  }

  const clientToken = authHeader.substring(7);
  const clientAuth = await verifyClientCredentialsToken(clientToken);

  // Step 2: Verify User Token (optional, for user-specific operations)
  const userTokenHeader = req.headers.get('X-User-Token') || req.headers.get('X-Forwarded-User-Token');
  
  let userAuth: { userId: string; email?: string; name?: string; rawToken: string } | null = null;
  
  if (userTokenHeader) {
    const userToken = userTokenHeader.startsWith('Bearer ') 
      ? userTokenHeader.substring(7) 
      : userTokenHeader;
    
    try {
      userAuth = await verifyUserToken(userToken);
    } catch (error: any) {
      console.error('[Dual Token Auth] User token verification failed:', error.message);
      // Don't fail the request if user token is invalid, just log it
      // Some operations don't require user context
    }
  }

  // Step 3: Build auth context
  const context: AuthContext = {
    clientId: clientAuth.clientId,
    clientScopes: clientAuth.scopes,
    authenticatedAt: new Date(),
    authMethod: userAuth ? 'dual-token' : 'client-only',
  };

  if (userAuth) {
    context.userId = userAuth.userId;
    context.userEmail = userAuth.email;
    context.userName = userAuth.name;
    context.userToken = userAuth.rawToken;
  }

  return context;
}

/**
 * Verify Client Credentials Token
 * This token proves that the calling service (e.g., ChatGPT Enterprise) is authorized
 */
async function verifyClientCredentialsToken(token: string): Promise<{
  clientId: string;
  scopes: string[];
}> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    // Get signing key from JWKS
    const key = await jwksClient_.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token signature and claims
    const verified = jwt.verify(token, signingKey, {
      audience: process.env.MCP_API_AUDIENCE || process.env.AUTH0_CLIENT_ID,
      issuer: process.env.AUTH0_ISSUER_BASE_URL,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    // Verify this is a client credentials token (not a user token)
    // Client credentials tokens have 'gty' (grant type) = 'client-credentials'
    if (verified.gty && verified.gty !== 'client-credentials') {
      throw new Error('Invalid grant type - expected client-credentials');
    }

    // Extract client ID
    // Auth0: 'azp', 'client_id', or 'sub'
    // Okta OIE: 'cid' (client_id) or 'sub'
    const clientId = verified.cid || verified.azp || verified.client_id || verified.sub;
    if (!clientId) {
      throw new Error('Client ID not found in token');
    }

    // Check if client is authorized (if whitelist is configured)
    const allowedClients = process.env.ALLOWED_MCP_CLIENTS?.split(',').map(c => c.trim()) || [];
    if (allowedClients.length > 0 && !allowedClients.includes(clientId)) {
      throw new Error(`Unauthorized client: ${clientId}`);
    }

    // Extract scopes
    const scopes = typeof verified.scope === 'string' 
      ? verified.scope.split(' ') 
      : (verified.scope || []);

    // Verify required scopes (if configured)
    const requiredScopes = process.env.REQUIRED_MCP_SCOPES?.split(',').map(s => s.trim()) || [];
    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope => scopes.includes(scope));
      if (!hasRequiredScopes) {
        throw new Error(`Missing required scopes. Required: ${requiredScopes.join(', ')}`);
      }
    }

    return {
      clientId,
      scopes,
    };
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error(`Invalid client token: ${error.message}`);
    }
    if (error.name === 'TokenExpiredError') {
      throw new Error('Client token has expired');
    }
    throw new Error(`Client token verification failed: ${error.message}`);
  }
}

/**
 * Verify User OAuth2 Token
 * This token provides user context for personalized operations
 */
async function verifyUserToken(token: string): Promise<{
  userId: string;
  email?: string;
  name?: string;
  rawToken: string;
}> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid user token format');
    }

    // Get signing key from JWKS
    const key = await jwksClient_.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token signature and claims
    // User tokens typically have the app's client_id as audience
    const verified = jwt.verify(token, signingKey, {
      audience: process.env.AUTH0_CLIENT_ID,
      issuer: process.env.AUTH0_ISSUER_BASE_URL,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    // User tokens should NOT be client credentials
    if (verified.gty === 'client-credentials') {
      throw new Error('User token cannot be a client credentials token');
    }

    // Extract user information
    const userId = verified.sub;
    if (!userId) {
      throw new Error('User ID (sub) not found in token');
    }

    return {
      userId,
      email: verified.email,
      name: verified.name,
      rawToken: token,
    };
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error(`Invalid user token: ${error.message}`);
    }
    if (error.name === 'TokenExpiredError') {
      throw new Error('User token has expired');
    }
    throw new Error(`User token verification failed: ${error.message}`);
  }
}

/**
 * Check if authentication context has user context
 */
export function hasUserContext(authContext: AuthContext): boolean {
  return authContext.authMethod === 'dual-token' && !!authContext.userId;
}

/**
 * Require user context - throws error if not present
 * Use this for operations that require user identity (checkout, payment, etc.)
 */
export function requireUserContext(authContext: AuthContext): void {
  if (!hasUserContext(authContext)) {
    throw new Error(
      'User context required. Please provide X-User-Token header with user OAuth2 token.'
    );
  }
}
