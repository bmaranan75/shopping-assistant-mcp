/**
 * OAuth2 Client Credentials Flow Implementation
 * 
 * This client handles:
 * - Token acquisition using client credentials
 * - Automatic token refresh
 * - Token caching
 * - Support for Auth0, Okta, and generic OAuth2 providers
 */

export interface OAuth2Config {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scope?: string;
}

export interface AccessToken {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType: string;
  scope?: string;
}

export class OAuth2Client {
  private config: OAuth2Config;
  private cachedToken: AccessToken | null = null;
  private tokenRefreshPromise: Promise<AccessToken> | null = null;

  constructor(config: OAuth2Config) {
    this.config = config;
  }

  /**
   * Get a valid access token (cached or new)
   * Automatically refreshes if token is expired or about to expire (within 5 minutes)
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token (with 5-minute buffer)
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (this.cachedToken && this.cachedToken.expiresAt > now + bufferMs) {
      console.log('[OAuth2 Client] Using cached token');
      return this.cachedToken.token;
    }

    // If a refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      console.log('[OAuth2 Client] Waiting for in-progress token refresh');
      const token = await this.tokenRefreshPromise;
      return token.token;
    }

    // Start a new token refresh
    console.log('[OAuth2 Client] Acquiring new access token');
    this.tokenRefreshPromise = this.fetchNewToken();

    try {
      const token = await this.tokenRefreshPromise;
      this.cachedToken = token;
      return token.token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Fetch a new access token using client credentials flow
   */
  private async fetchNewToken(): Promise<AccessToken> {
    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    // Add audience if provided (required for Auth0)
    if (this.config.audience) {
      requestBody.append('audience', this.config.audience);
    }

    // Add scope if provided
    if (this.config.scope) {
      requestBody.append('scope', this.config.scope);
    }

    try {
      console.log('[OAuth2 Client] Requesting token from:', this.config.tokenEndpoint);
      console.log('[OAuth2 Client] Client ID:', this.config.clientId);
      console.log('[OAuth2 Client] Audience:', this.config.audience || 'none');
      console.log('[OAuth2 Client] Scope:', this.config.scope || 'default');

      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OAuth2 token request failed (${response.status}): ${errorText}`
        );
      }

      const data = await response.json() as {
        access_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
      };

      // Validate response
      if (!data.access_token) {
        throw new Error('OAuth2 response missing access_token');
      }

      // Calculate expiration time
      const expiresIn = data.expires_in || 3600; // Default to 1 hour if not provided
      const expiresAt = Date.now() + expiresIn * 1000;

      console.log('[OAuth2 Client] Token acquired successfully');
      console.log('[OAuth2 Client] Expires in:', expiresIn, 'seconds');
      console.log('[OAuth2 Client] Token type:', data.token_type || 'Bearer');

      return {
        token: data.access_token,
        expiresAt,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
      };
    } catch (error: any) {
      console.error('[OAuth2 Client] Failed to fetch access token:', error.message);
      throw new Error(`OAuth2 token acquisition failed: ${error.message}`);
    }
  }

  /**
   * Force refresh the access token (bypass cache)
   */
  async refreshToken(): Promise<string> {
    console.log('[OAuth2 Client] Forcing token refresh');
    this.cachedToken = null;
    return this.getAccessToken();
  }

  /**
   * Clear cached token
   */
  clearCache(): void {
    console.log('[OAuth2 Client] Clearing token cache');
    this.cachedToken = null;
  }

  /**
   * Get current token info (for debugging)
   */
  getTokenInfo(): { cached: boolean; expiresAt?: number; expiresIn?: number } {
    if (!this.cachedToken) {
      return { cached: false };
    }

    const now = Date.now();
    const expiresIn = Math.floor((this.cachedToken.expiresAt - now) / 1000);

    return {
      cached: true,
      expiresAt: this.cachedToken.expiresAt,
      expiresIn: Math.max(0, expiresIn),
    };
  }
}

/**
 * Create OAuth2 client from environment variables
 */
export function createOAuth2ClientFromEnv(): OAuth2Client {
  const tokenEndpoint = process.env.OAUTH2_TOKEN_ENDPOINT;
  const clientId = process.env.OAUTH2_CLIENT_ID;
  const clientSecret = process.env.OAUTH2_CLIENT_SECRET;
  const audience = process.env.OAUTH2_AUDIENCE;
  const scope = process.env.OAUTH2_SCOPE;

  // Validate required variables
  if (!tokenEndpoint) {
    throw new Error('OAUTH2_TOKEN_ENDPOINT environment variable is required');
  }

  if (!clientId) {
    throw new Error('OAUTH2_CLIENT_ID environment variable is required');
  }

  if (!clientSecret) {
    throw new Error('OAUTH2_CLIENT_SECRET environment variable is required');
  }

  console.log('[OAuth2 Client] Initializing with:');
  console.log('  Token Endpoint:', tokenEndpoint);
  console.log('  Client ID:', clientId);
  console.log('  Audience:', audience || 'none');
  console.log('  Scope:', scope || 'default');

  return new OAuth2Client({
    tokenEndpoint,
    clientId,
    clientSecret,
    audience,
    scope,
  });
}
