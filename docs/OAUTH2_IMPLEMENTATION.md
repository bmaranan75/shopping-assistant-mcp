# OAuth2 Authentication Implementation Summary

## What Changed

The MCP server has been upgraded from simple API key authentication to support OAuth2 client credentials flow with an optional dual-token pattern.

## Key Features

### 1. **OAuth2 Client Credentials Flow**
- Industry-standard authentication
- Token-based with automatic expiration
- JWKS-based signature verification
- Support for Auth0, Okta, and generic OAuth2 providers

### 2. **Dual Token Pattern (Optional)**
- **Access Token** (required): Proves the calling application is authorized
- **User Token** (optional): Provides user context for personalized operations

### 3. **Flexible Authentication Modes**
- `oauth2`: OAuth2 only (recommended)
- `api-key`: Legacy API key (deprecated)
- `hybrid`: Both OAuth2 and API key
- `none`: No authentication (development only)

### 4. **Security Features**
- Token expiration and automatic refresh
- Client whitelisting (`ALLOWED_MCP_CLIENTS`)
- Scope-based permissions (`REQUIRED_MCP_SCOPES`)
- JWKS caching for performance

## Files Created

### Core Implementation
- **`src/lib/oauth2-client.ts`**: OAuth2 client with token caching and refresh
- **`src/mcp/auth-verifier.ts`**: Authentication verification for the MCP server

### Documentation & Examples
- **`docs/OAUTH2_MIGRATION.md`**: Complete migration guide
- **`examples/oauth2-client-example.ts`**: TypeScript example
- **`scripts/test-oauth2.sh`**: Shell script for testing

## Files Modified

### Server Configuration
- **`src/mcp/server.ts`**: 
  - Added OAuth2 authentication middleware
  - Validates tokens on SSE connections
  - Passes tokens to downstream services
  
- **`src/mcp/client.ts`**:
  - Updated to accept and pass OAuth2 tokens
  - Support for both access token and user token

- **`.env.local`**:
  - Added OAuth2 configuration variables
  - Documented authentication modes

### Documentation
- **`README.md`**:
  - Updated configuration section
  - Added OAuth2 setup instructions
  - Documented authentication modes

## Configuration

### Required Environment Variables (OAuth2 Mode)

```bash
# Authentication mode
MCP_AUTH_MODE=oauth2

# OAuth2 provider configuration
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
MCP_API_AUDIENCE=https://api.your-domain.com/mcp
AUTH0_CLIENT_ID=your-client-id
```

### Optional Configuration

```bash
# Restrict allowed clients
ALLOWED_MCP_CLIENTS=client-id-1,client-id-2

# Require specific scopes
REQUIRED_MCP_SCOPES=mcp:read,mcp:execute

# Identity provider (auth0 or okta)
IDENTITY_PROVIDER=auth0
```

## How It Works

### Server Side (Token Verification)

1. Client connects to `/sse` endpoint with `Authorization: Bearer <token>` header
2. Server extracts and decodes the JWT token
3. Server fetches public key from JWKS endpoint
4. Server verifies token signature, audience, issuer, and expiration
5. Server optionally checks client whitelist and required scopes
6. If valid, connection is established and tokens are passed to agent client
7. Agent client includes tokens when calling Next.js API

### Client Side (Token Acquisition)

1. Client requests token from OAuth2 provider:
   ```
   POST /oauth/token
   grant_type=client_credentials
   client_id=...
   client_secret=...
   audience=...
   ```

2. Provider returns access token with expiration
3. Client uses token in requests: `Authorization: Bearer <token>`
4. Client can optionally include user token: `X-User-Token: Bearer <user_token>`

## Backward Compatibility

### Hybrid Mode

During migration, use hybrid mode to support both authentication methods:

```bash
MCP_AUTH_MODE=hybrid
MCP_API_KEY=your-old-key  # Still works
# OAuth2 tokens also accepted
```

### Legacy API Key

Existing API key authentication still works in `api-key` or `hybrid` mode:

```bash
curl -X POST http://localhost:3001/sse \
  -H "X-MCP-API-Key: your-secret-key"
```

## Testing

### Quick Test with Shell Script

```bash
export AUTH0_DOMAIN="your-tenant.auth0.com"
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
export AUDIENCE="https://api.your-domain.com/mcp"

./scripts/test-oauth2.sh
```

### TypeScript Example

```bash
npx tsx examples/oauth2-client-example.ts
```

### Manual Test with curl

```bash
# 1. Get token
TOKEN=$(curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "audience=$AUDIENCE" | jq -r '.access_token')

# 2. Test health endpoint (no auth)
curl http://localhost:3001/health

# 3. Test SSE endpoint (with auth)
curl -X POST http://localhost:3001/sse \
  -H "Authorization: Bearer $TOKEN"
```

## Dependencies

Already included in package.json:
- `jsonwebtoken`: ^9.0.2
- `jwks-rsa`: ^3.2.0
- `@types/jsonwebtoken`: ^9.0.10

## Migration Path

1. **Phase 1**: Set up OAuth2 provider (Auth0/Okta)
2. **Phase 2**: Enable hybrid mode (`MCP_AUTH_MODE=hybrid`)
3. **Phase 3**: Migrate clients to OAuth2 tokens
4. **Phase 4**: Switch to OAuth2-only mode (`MCP_AUTH_MODE=oauth2`)
5. **Phase 5**: Remove legacy API key configuration

See [docs/OAUTH2_MIGRATION.md](docs/OAUTH2_MIGRATION.md) for detailed steps.

## Security Benefits

1. **Token Expiration**: Tokens expire automatically (typically 1 hour)
2. **No Shared Secrets**: Each client has unique credentials
3. **Fine-grained Permissions**: Scope-based access control
4. **Auditability**: Track which client made which requests
5. **User Context**: Optional user token for personalized operations
6. **Standards-based**: Industry-standard OAuth2 protocol

## Next Steps

- [ ] Configure OAuth2 provider (Auth0/Okta)
- [ ] Create API and M2M application
- [ ] Update `.env.local` with OAuth2 credentials
- [ ] Test with provided scripts
- [ ] Migrate clients to OAuth2
- [ ] Enable OAuth2-only mode
- [ ] Set up monitoring and logging

## Support

For questions or issues:
1. Review [README.md](README.md) for configuration
2. Check [docs/OAUTH2_MIGRATION.md](docs/OAUTH2_MIGRATION.md) for migration steps
3. Run test scripts to verify setup
4. Check server logs for authentication errors
