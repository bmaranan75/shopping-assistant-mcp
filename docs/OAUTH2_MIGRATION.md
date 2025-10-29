# Migration Guide: API Key to OAuth2 Authentication

This guide explains how to migrate from API key authentication to OAuth2 client credentials flow.

## Overview

**Before (API Key):**
- Simple string-based authentication
- Single shared secret
- No user context
- Limited security and auditability

**After (OAuth2):**
- Standards-based authentication
- Token-based with expiration
- Supports dual-token pattern (client + user)
- Better security, scoping, and auditability

## Migration Steps

### 1. Set Up OAuth2 Provider (Auth0 Example)

#### Create an API
1. Go to Auth0 Dashboard → Applications → APIs
2. Click "Create API"
3. Configure:
   - **Name**: Shopping Assistant MCP API
   - **Identifier**: `https://api.your-domain.com/mcp` (this becomes your audience)
   - **Signing Algorithm**: RS256
4. Save the identifier as your `MCP_API_AUDIENCE`

#### Create Machine-to-Machine Application
1. Go to Auth0 Dashboard → Applications → Applications
2. Click "Create Application"
3. Choose "Machine to Machine Applications"
4. Name it: "MCP Client Application"
5. Authorize it to access your MCP API
6. Grant necessary permissions (e.g., `mcp:read`, `mcp:execute`)
7. Note the **Client ID** and **Client Secret**

### 2. Update MCP Server Configuration

Update your `.env.local`:

```bash
# Change authentication mode from api-key to oauth2
MCP_AUTH_MODE=oauth2  # Was: not set (defaulted to api-key)

# Add OAuth2 configuration
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
MCP_API_AUDIENCE=https://api.your-domain.com/mcp

# Optional: Keep API key for backward compatibility during migration
# MCP_AUTH_MODE=hybrid  # Supports both OAuth2 and API key
# MCP_API_KEY=your-old-key
```

### 3. Update Clients

#### Before (API Key):
```bash
curl -X POST http://localhost:3001/sse \
  -H "X-MCP-API-Key: your-secret-key"
```

#### After (OAuth2):

**Step 1: Obtain access token**
```bash
TOKEN_RESPONSE=$(curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "audience=https://api.your-domain.com/mcp")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')
```

**Step 2: Use token in requests**
```bash
curl -X POST http://localhost:3001/sse \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### Code Example (TypeScript/JavaScript):

**Before:**
```typescript
const client = new MCPAgentClient(
  'http://localhost:3000',
  'your-secret-api-key'
);
```

**After:**
```typescript
// 1. Obtain token
const tokenResponse = await fetch('https://your-tenant.auth0.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    audience: 'https://api.your-domain.com/mcp',
  }),
});

const { access_token } = await tokenResponse.json();

// 2. Use token with client
const client = new MCPAgentClient('http://localhost:3000', access_token);
```

### 4. Testing

Use the provided test script:

```bash
# Set environment variables
export AUTH0_DOMAIN="your-tenant.auth0.com"
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
export AUDIENCE="https://api.your-domain.com/mcp"

# Run the test
./scripts/test-oauth2.sh
```

Or run the TypeScript example:

```bash
npm install
npx tsx examples/oauth2-client-example.ts
```

### 5. Gradual Migration with Hybrid Mode

For zero-downtime migration, use hybrid mode:

```bash
# In .env.local
MCP_AUTH_MODE=hybrid
```

This allows both OAuth2 tokens AND API keys simultaneously:
- New clients use OAuth2 tokens
- Existing clients continue using API keys
- Migrate clients gradually
- Switch to `oauth2` mode when all clients are migrated

## Security Improvements

### Token Expiration
- **API Key**: Never expires (security risk)
- **OAuth2**: Tokens expire (typically 1 hour), requiring renewal

### Scopes and Permissions
- **API Key**: All-or-nothing access
- **OAuth2**: Fine-grained permissions via scopes (e.g., `mcp:read`, `mcp:execute`)

### Auditability
- **API Key**: Hard to track which client made requests
- **OAuth2**: Each client has unique credentials, enabling proper auditing

### User Context (Dual Token Pattern)
- **API Key**: No user information
- **OAuth2**: Optional user token provides user context for personalized operations

## Dual Token Pattern (Optional)

For user-specific operations, you can include both tokens:

```bash
curl -X POST http://localhost:3001/sse \
  -H "Authorization: Bearer $CLIENT_ACCESS_TOKEN" \
  -H "X-User-Token: Bearer $USER_OAUTH_TOKEN"
```

**Use cases:**
- `Authorization` (required): Proves your app is authorized to access the MCP
- `X-User-Token` (optional): Provides user context for cart, checkout, etc.

## Troubleshooting

### 401 Unauthorized

**Check:**
1. Token is valid and not expired
2. Audience matches `MCP_API_AUDIENCE` in server config
3. Issuer matches `AUTH0_ISSUER_BASE_URL`
4. Client ID is in `ALLOWED_MCP_CLIENTS` (if configured)

### Invalid Token Format

**Check:**
1. Token is being sent as `Bearer <token>` (note the space)
2. Header is `Authorization`, not `Authentication`
3. Token is not URL-encoded

### Missing Scopes

**Check:**
1. Client has been granted permissions in Auth0
2. Token request includes required scopes
3. `REQUIRED_MCP_SCOPES` in server config matches granted permissions

## Rollback Plan

If you need to rollback:

```bash
# In .env.local
MCP_AUTH_MODE=api-key
MCP_API_KEY=your-old-key

# Remove OAuth2 config (optional)
# AUTH0_ISSUER_BASE_URL=...
# MCP_API_AUDIENCE=...
```

Restart the MCP server and you'll be back to API key authentication.

## Next Steps

1. **Set up monitoring**: Track token usage and failures
2. **Configure scopes**: Define granular permissions for different operations
3. **Add rate limiting**: Protect against token abuse
4. **Implement token caching**: Reduce token requests (already included in OAuth2Client)
5. **Enable user tokens**: Support personalized operations with dual-token pattern

## Support

For issues or questions:
1. Check the [README.md](../README.md) for configuration details
2. Review the [examples/oauth2-client-example.ts](../examples/oauth2-client-example.ts)
3. Test with [scripts/test-oauth2.sh](../scripts/test-oauth2.sh)
