/**
 * OpenID Connect Discovery endpoint for MCP Server
 * 
 * This provides a standard .well-known/openid-configuration endpoint
 * that makes it easy to integrate with ChatGPT Enterprise and other OAuth2 clients.
 * 
 * The configuration is fetched from the upstream OAuth2 provider (Azure AD)
 * and adapted for the MCP server's endpoints.
 */

export interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri: string;
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  claims_supported?: string[];
  grant_types_supported?: string[];
  // Additional fields from upstream provider
  [key: string]: any;
}

let cachedConfig: OpenIDConfiguration | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch OpenID configuration from upstream provider
 */
async function fetchUpstreamConfig(upstreamUrl: string): Promise<OpenIDConfiguration> {
  console.log('[OpenID Discovery] Fetching config from:', upstreamUrl);
  
  const response = await fetch(upstreamUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch upstream config: ${response.status} ${response.statusText}`);
  }
  
  const config = await response.json() as OpenIDConfiguration;
  console.log('[OpenID Discovery] Successfully fetched upstream config');
  
  return config;
}

/**
 * Get OpenID Connect discovery configuration
 * Caches the result for performance
 */
export async function getOpenIDConfiguration(): Promise<OpenIDConfiguration> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[OpenID Discovery] Returning cached config');
    return cachedConfig;
  }
  
  // Get upstream OpenID configuration URL from environment
  const upstreamConfigUrl = process.env.OAUTH2_OPENID_CONFIG_URL;
  
  if (!upstreamConfigUrl) {
    // Fallback: construct from environment variables
    const jwksUri = process.env.OAUTH2_JWKS_URI;
    const issuer = process.env.OAUTH2_ISSUER;
    const tokenEndpoint = process.env.OAUTH2_TOKEN_ENDPOINT;
    
    if (!jwksUri) {
      throw new Error('OAUTH2_JWKS_URI is required');
    }
    
    // Construct token endpoint from issuer if not provided
    const defaultTokenEndpoint = issuer 
      ? `${issuer.replace(/\/$/, '')}/oauth/token`
      : undefined;
    
    // Return minimal config for Client Credentials flow only
    // No authorization_endpoint to prevent user login prompts
    const config: OpenIDConfiguration = {
      issuer: issuer || 'unknown',
      token_endpoint: tokenEndpoint || defaultTokenEndpoint,
      jwks_uri: jwksUri,
      response_types_supported: ['token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      grant_types_supported: ['client_credentials'],
    };
    
    console.log('[OpenID Discovery] Using minimal config (Client Credentials flow only)');
    console.log('[OpenID Discovery] Token endpoint:', config.token_endpoint);
    
    cachedConfig = config;
    cacheTimestamp = now;
    
    return config;
  }
  
  try {
    // Fetch from upstream provider
    const upstreamConfig = await fetchUpstreamConfig(upstreamConfigUrl);
    
    // Remove authorization_endpoint to prevent user login prompts
    // This forces clients like ChatGPT Enterprise to use Client Credentials flow only
    const {
      authorization_endpoint,
      userinfo_endpoint,
      end_session_endpoint,
      ...mcpConfig
    } = upstreamConfig;
    
    // Ensure only client_credentials grant type is advertised
    // MUST include token_endpoint for ChatGPT Enterprise to recognize OAuth support
    const filteredConfig: OpenIDConfiguration = {
      ...mcpConfig,
      grant_types_supported: ['client_credentials'],
      response_types_supported: ['token'],
      // Ensure token_endpoint is present (should already be in mcpConfig)
      token_endpoint: mcpConfig.token_endpoint || upstreamConfig.token_endpoint,
    };
    
    console.log('[OpenID Discovery] Filtered config to support only Client Credentials flow');
    console.log('[OpenID Discovery] Token endpoint:', filteredConfig.token_endpoint);
    
    // Cache the config
    cachedConfig = filteredConfig;
    cacheTimestamp = now;
    
    return filteredConfig;
  } catch (error: any) {
    console.error('[OpenID Discovery] Failed to fetch upstream config:', error.message);
    
    // Return cached config if available, even if expired
    if (cachedConfig) {
      console.log('[OpenID Discovery] Returning stale cached config due to error');
      return cachedConfig;
    }
    
    throw error;
  }
}

/**
 * Clear the cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}
