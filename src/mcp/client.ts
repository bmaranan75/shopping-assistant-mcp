/**
 * HTTP client for MCP server to call Next.js API routes
 * The client can pass OAuth2 access tokens for authentication
 */
export class MCPAgentClient {
  private baseUrl: string;
  private accessToken: string | null;
  private userToken?: string | null;

  constructor(baseUrl: string, accessToken: string | null = null, userToken?: string | null) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.userToken = userToken;
  }

  /**
   * Set the access token (client credentials token)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Set the user token (optional, for user-specific operations)
   */
  setUserToken(token: string): void {
    this.userToken = token;
  }

  /**
   * Call an agent via HTTP with retry logic
   */
  async callAgent(
    agentName: string,
    data: any,
    retries = 3
  ): Promise<any> {
    const endpoint = `${this.baseUrl}/api/mcp/agents/${agentName}`;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.error(`[MCP Client] Calling ${agentName}:`, JSON.stringify(data, null, 2));

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add OAuth2 access token if available
        if (this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        // Add user token if available (optional)
        if (this.userToken) {
          headers['X-User-Token'] = `Bearer ${this.userToken}`;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.error(`[MCP Client] Success from ${agentName}`);
        return result;

      } catch (error: any) {
        console.error(`[MCP Client] Attempt ${attempt + 1} failed:`, error.message);

        if (attempt === retries - 1) {
          throw new Error(`Failed after ${retries} attempts: ${error.message}`);
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }
}
