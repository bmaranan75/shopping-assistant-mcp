import http from 'http';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Generic OAuth2 authentication verifier for MCP Server
 * Supports standard OAuth2 client credentials flow with JWKS verification
 * Works with any OAuth2 provider (Auth0, Okta, Azure AD, etc.)
 */

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  userToken?: string;
  clientId?: string;
  userId?: string;
  error?: string;
}

// Lazy-initialize JWKS client only when needed
let jwksClientInstance: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient {
  if (!jwksClientInstance) {
    const jwksUri = process.env.OAUTH2_JWKS_URI;
    
    if (!jwksUri) {
      throw new Error('OAUTH2_JWKS_URI environment variable is required for OAuth2 authentication');
    }

    jwksClientInstance = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  return jwksClientInstance;
}

/**
 * Verify OAuth2 access token using standard JWT verification
 */
async function verifyAccessToken(token: string): Promise<{ clientId: string; scopes: string[] }> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    // Get signing key from JWKS
    const client = getJwksClient();
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Get verification options from environment
    const audience = process.env.OAUTH2_AUDIENCE;
    const issuer = process.env.OAUTH2_ISSUER;

    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
    };

    if (audience) {
      verifyOptions.audience = audience;
    }

    if (issuer) {
      verifyOptions.issuer = issuer;
    }

    // Verify token signature and claims
    const verified = jwt.verify(token, signingKey, verifyOptions) as jwt.JwtPayload;

    // Extract client ID from standard OAuth2 claims
    // Try multiple common claim names used by different providers
    const clientId = 
      verified.client_id ||  // Standard OAuth2
      verified.azp ||        // Auth0, Google
      verified.appid ||      // Azure AD
      verified.cid ||        // Okta
      verified.sub;          // Fallback to subject

    if (!clientId) {
      throw new Error('Client ID not found in token');
    }

    // Check allowed clients if configured
    const allowedClients = process.env.ALLOWED_MCP_CLIENTS?.split(',').map(c => c.trim()) || [];
    if (allowedClients.length > 0 && !allowedClients.includes(clientId)) {
      throw new Error(`Unauthorized client: ${clientId}`);
    }

    // Extract scopes from standard OAuth2 scope claim
    const scopes = typeof verified.scope === 'string' 
      ? verified.scope.split(' ') 
      : (Array.isArray(verified.scp) ? verified.scp : []); // Azure AD uses 'scp'

    // Verify required scopes if configured
    const requiredScopes = process.env.REQUIRED_MCP_SCOPES?.split(',').map(s => s.trim()) || [];
    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope => scopes.includes(scope));
      if (!hasRequiredScopes) {
        throw new Error(`Missing required scopes. Required: ${requiredScopes.join(', ')}`);
      }
    }

    return { clientId, scopes };
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error(`Invalid token: ${error.message}`);
    }
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

/**
 * Verify user token (optional) using standard JWT verification
 */
async function verifyUserToken(token: string): Promise<{ userId: string; email?: string }> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid user token format');
    }

    const client = getJwksClient();
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Get verification options from environment
    const audience = process.env.OAUTH2_AUDIENCE;
    const issuer = process.env.OAUTH2_ISSUER;

    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
    };

    if (audience) {
      verifyOptions.audience = audience;
    }

    if (issuer) {
      verifyOptions.issuer = issuer;
    }

    const verified = jwt.verify(token, signingKey, verifyOptions) as jwt.JwtPayload;

    // Extract user ID from standard claims
    const userId = verified.sub;
    if (!userId) {
      throw new Error('User ID (sub) not found in token');
    }

    return {
      userId,
      email: verified.email || verified.upn, // upn is used by Azure AD
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
 * Extract and verify authentication from HTTP request
 */
export async function verifyAuth(req: http.IncomingMessage): Promise<AuthResult> {
  const authMode = process.env.MCP_AUTH_MODE || 'oauth2';

  // No authentication required
  if (authMode === 'none') {
    return { success: true };
  }

  // Extract Authorization header
  const authHeader = req.headers['authorization'];
  const hasOAuthToken = authHeader?.startsWith('Bearer ');

  // OAuth2 Mode
  if (hasOAuthToken && (authMode === 'oauth2' || authMode === 'hybrid')) {
    try {
      const accessToken = authHeader!.substring(7); // Safe because hasOAuthToken checks this
      const { clientId } = await verifyAccessToken(accessToken);

      // Check for optional user token
      let userToken: string | undefined;
      let userId: string | undefined;

      const userTokenHeader = req.headers['x-user-token'] as string | undefined;
      if (userTokenHeader) {
        const token = userTokenHeader.startsWith('Bearer ') 
          ? userTokenHeader.substring(7) 
          : userTokenHeader;
        
        try {
          const userAuth = await verifyUserToken(token);
          userId = userAuth.userId;
          userToken = token;
        } catch (error: any) {
          console.error('[MCP Auth] User token verification failed:', error.message);
          // Don't fail the request, just log it
        }
      }

      console.log('[MCP Auth] OAuth2 authentication successful:', {
        clientId,
        userId: userId || 'none',
      });

      return {
        success: true,
        accessToken,
        userToken,
        clientId,
        userId,
      };
    } catch (error: any) {
      console.error('[MCP Auth] OAuth2 verification failed:', error.message);
      return {
        success: false,
        error: `OAuth2 authentication failed: ${error.message}`,
      };
    }
  }

  // API Key Mode (legacy)
  if (authMode === 'api-key' || authMode === 'hybrid') {
    const apiKey = req.headers['x-mcp-api-key'] as string | undefined;
    const expectedKey = process.env.MCP_API_KEY;

    if (!expectedKey) {
      return {
        success: false,
        error: 'MCP authentication not configured',
      };
    }

    if (apiKey === expectedKey) {
      console.log('[MCP Auth] API Key authentication successful');
      return { success: true };
    }

    if (!hasOAuthToken) {
      return {
        success: false,
        error: 'Invalid or missing API key',
      };
    }
  }

  return {
    success: false,
    error: 'No valid authentication provided',
  };
}

/**
 * Send authentication error response
 */
export function sendAuthError(res: http.ServerResponse, message: string): void {
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'Bearer realm="MCP Server"',
  });
  res.end(JSON.stringify({
    error: 'Unauthorized',
    message,
  }));
}
