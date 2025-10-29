/**
 * Example: MCP Client with OAuth2 Authentication
 * 
 * This example shows how to obtain an OAuth2 access token and use it with the MCP server.
 * Works with any OAuth2 provider (Auth0, Azure AD, Okta, Keycloak, etc.)
 * 
 * Architecture:
 * 1. Client obtains access token from OAuth2 provider using client credentials
 * 2. Client connects to MCP server via SSE with Authorization header
 * 3. MCP server verifies the token using JWKS (public keys)
 * 
 * Optional: Include user token for personalized operations
 * 
 * Note: The MCP SDK's SSEClientTransport doesn't directly support custom headers.
 * For OAuth2 authentication with the SDK, you'll need to use a proxy.
 * This example shows the OAuth2 flow and how to test with HTTP requests.
 */

interface OAuth2Config {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scope?: string;
}

/**
 * Obtain an OAuth2 access token using client credentials flow
 * Works with any OAuth2-compliant provider
 */
async function getAccessToken(config: OAuth2Config): Promise<string> {
  console.log('Requesting access token from:', config.tokenEndpoint);
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  // Audience is required by some providers (Auth0, Azure AD)
  if (config.audience) {
    body.append('audience', config.audience);
    // Azure AD uses 'resource' instead of 'audience'
    body.append('resource', config.audience);
  }

  // Scope is optional but recommended
  if (config.scope) {
    body.append('scope', config.scope);
  }

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to obtain access token: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  console.log('✓ Access token obtained (expires in', data.expires_in, 'seconds)');
  return data.access_token;
}

/**
 * Example: Get access token and show how to use it
 */
async function demonstrateOAuth2Flow() {
  console.log('=== OAuth2 Client Credentials Flow Example ===\n');

  // Step 1: Configure OAuth2
  const oauth2Config: OAuth2Config = {
    // Token endpoint varies by provider:
    // Auth0: https://{tenant}.{region}.auth0.com/oauth/token
    // Azure AD: https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token
    // Okta: https://{org}.okta.com/oauth2/default/v1/token
    // Keycloak: https://{domain}/auth/realms/{realm}/protocol/openid-connect/token
    tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT || 'https://your-provider.com/oauth/token',
    
    clientId: process.env.CLIENT_ID || 'your-client-id',
    clientSecret: process.env.CLIENT_SECRET || 'your-client-secret',
    
    // Audience (optional, required by some providers like Auth0, Azure AD)
    // Should match OAUTH2_AUDIENCE in the MCP server's .env
    audience: process.env.OAUTH2_AUDIENCE,
    
    // Optional: Request specific scopes
    scope: 'mcp:read mcp:execute',
  };

  try {
    // Step 2: Obtain access token
    const accessToken = await getAccessToken(oauth2Config);
    
    console.log('\n✓ Successfully obtained access token');
    console.log('  Token preview:', accessToken.substring(0, 30) + '...\n');

    // Step 3: Show how to use the token
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001';

    console.log('=== How to Use the Access Token ===\n');
    
    console.log('1. Connect to MCP SSE endpoint:');
    console.log(`   POST ${mcpServerUrl}/sse`);
    console.log('   Headers:');
    console.log(`     Authorization: Bearer ${accessToken.substring(0, 20)}...`);
    console.log('     (Optional) X-User-Token: Bearer <user_oauth_token>');
    
    console.log('\n2. Using curl:');
    console.log(`   curl -X POST ${mcpServerUrl}/sse \\`);
    console.log(`     -H "Authorization: Bearer ${accessToken}" \\`);
    console.log(`     -H "Content-Type: application/json"`);
    
    console.log('\n3. Health check (no auth required):');
    const healthResponse = await fetch(`${mcpServerUrl}/health`);
    const health = await healthResponse.json();
    console.log('   Status:', health.status);
    console.log('   Available tools:', health.tools?.join(', '));

    console.log('\n=== Dual Token Pattern (Optional) ===\n');
    console.log('For user-specific operations, you can also include a user token:');
    console.log('  Authorization: Bearer <client_access_token>  (required)');
    console.log('  X-User-Token: Bearer <user_oauth_token>      (optional)');
    console.log('\nThe MCP server will:');
    console.log('  1. Verify the client access token (proves your app is authorized)');
    console.log('  2. Optionally verify the user token (provides user context)');
    console.log('  3. Pass both tokens to downstream services if needed');

    console.log('\n=== Example Complete ===');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check that OAUTH2_TOKEN_ENDPOINT is correct for your provider');
    console.error('2. Verify CLIENT_ID and CLIENT_SECRET are valid');
    console.error('3. Ensure the client has permissions to access the API');
    console.error('4. For Auth0/Azure AD, verify the audience parameter is correct');
    console.error('5. Check that required scopes are granted to the client');
    throw error;
  }
}

// Run the example
demonstrateOAuth2Flow()
  .then(() => {
    console.log('\nTo test the MCP server:');
    console.log('1. Ensure the MCP server is running (npm run dev)');
    console.log('2. Use the access token from above in your requests');
    console.log('3. Try the health endpoint first to verify connectivity');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed to complete OAuth2 flow:', error.message);
    process.exit(1);
  });

