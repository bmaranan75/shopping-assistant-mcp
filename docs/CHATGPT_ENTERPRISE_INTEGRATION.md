# ChatGPT Enterprise Integration Guide

## Overview

This MCP server now provides an OpenID Connect Discovery endpoint that makes it easy to integrate with ChatGPT Enterprise and other OAuth2 clients.

## Discovery Endpoint

The server exposes a standard `.well-known/openid-configuration` endpoint:

```
http://localhost:3001/.well-known/openid-configuration
```

This endpoint proxies and caches the OpenID configuration from Azure AD, making it discoverable for ChatGPT Enterprise.

## Configuration

### Environment Variables

In your `.env.local`:

```bash
# OpenID Connect Discovery URL (fetches config from Azure AD)
OAUTH2_OPENID_CONFIG_URL=https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/.well-known/openid-configuration

# JWKS endpoint
OAUTH2_JWKS_URI=https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/discovery/v2.0/keys

# Token issuer
OAUTH2_ISSUER=https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/

# Token audience
OAUTH2_AUDIENCE=00000002-0000-0000-c000-000000000000
```

## Testing the Discovery Endpoint

### 1. Start the MCP Server

```bash
npm run dev
```

### 2. Test the Discovery Endpoint

```bash
curl http://localhost:3001/.well-known/openid-configuration
```

**Expected Response:**
```json
{
  "token_endpoint": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token",
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "private_key_jwt",
    "client_secret_basic"
  ],
  "jwks_uri": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/discovery/v2.0/keys",
  "response_modes_supported": [
    "query",
    "fragment",
    "form_post"
  ],
  "subject_types_supported": [
    "pairwise"
  ],
  "id_token_signing_alg_values_supported": [
    "RS256"
  ],
  "response_types_supported": [
    "code",
    "id_token",
    "code id_token",
    "id_token token"
  ],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "offline_access"
  ],
  "issuer": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/v2.0",
  "request_uri_parameter_supported": false,
  "userinfo_endpoint": "https://graph.microsoft.com/oidc/userinfo",
  "authorization_endpoint": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/authorize",
  "device_authorization_endpoint": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/devicecode",
  "http_logout_supported": true,
  "frontchannel_logout_supported": true,
  "end_session_endpoint": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/logout",
  "claims_supported": [
    "sub",
    "iss",
    "cloud_instance_name",
    "cloud_instance_host_name",
    "cloud_graph_host_name",
    "msgraph_host",
    "aud",
    "exp",
    "iat",
    "auth_time",
    "acr",
    "nonce",
    "preferred_username",
    "name",
    "tid",
    "ver",
    "at_hash",
    "c_hash",
    "email"
  ],
  "kerberos_endpoint": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/kerberos",
  "tenant_region_scope": null,
  "cloud_instance_name": "microsoftonline.com",
  "cloud_graph_host_name": "graph.windows.net",
  "msgraph_host": "graph.microsoft.com",
  "rbac_url": "https://pas.windows.net"
}
```

## ChatGPT Enterprise Integration

### Step 1: Configure MCP Server as OAuth2 Resource

In ChatGPT Enterprise settings:

1. **OAuth2 Configuration Method**: Discovery URL
2. **Discovery URL**: `http://localhost:3001/.well-known/openid-configuration`
   - For production: Use your public MCP server URL
3. **Client ID**: Your Azure AD application client ID
4. **Client Secret**: Your Azure AD application client secret

ChatGPT will automatically discover:
- ✅ Token endpoint
- ✅ JWKS URI
- ✅ Supported grant types
- ✅ Supported scopes
- ✅ Authorization endpoint (if needed)

### Step 2: Configure MCP Actions

In ChatGPT Enterprise, configure the MCP actions:

**MCP Server Base URL**: `http://localhost:3001`

**Available Endpoints**:
- `POST /sse` - MCP protocol endpoint (requires OAuth2 token)
- `GET /health` - Health check (no auth required)
- `GET /.well-known/openid-configuration` - Discovery (no auth required)

### Step 3: Test Integration

ChatGPT Enterprise will:
1. Fetch OpenID configuration from `/.well-known/openid-configuration`
2. Obtain access token from Azure AD using client credentials
3. Call MCP endpoints with `Authorization: Bearer <token>` header
4. MCP server verifies token using JWKS from Azure AD

## Manual Testing

### Test Discovery Endpoint

```bash
# Get OpenID configuration
curl http://localhost:3001/.well-known/openid-configuration | jq .
```

### Test Full Flow

```bash
# 1. Get access token from Azure AD
TOKEN=$(curl -s -X POST \
  "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=00000002-0000-0000-c000-000000000000/.default" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# 2. Test MCP endpoint with token
curl -X POST http://localhost:3001/sse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

## Production Deployment

For production use with ChatGPT Enterprise:

### 1. Deploy MCP Server

Deploy to a publicly accessible URL (e.g., `https://mcp.yourdomain.com`)

### 2. Update Environment Variables

```bash
# Production URLs
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=443  # or your production port

# Keep Azure AD configuration
OAUTH2_OPENID_CONFIG_URL=https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/.well-known/openid-configuration
OAUTH2_JWKS_URI=https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/discovery/v2.0/keys
OAUTH2_ISSUER=https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/
OAUTH2_AUDIENCE=00000002-0000-0000-c000-000000000000
```

### 3. Configure ChatGPT Enterprise

Use your production URL:
- **Discovery URL**: `https://mcp.yourdomain.com/.well-known/openid-configuration`
- **MCP Base URL**: `https://mcp.yourdomain.com`

## Troubleshooting

### Discovery Endpoint Returns 500

**Check**:
1. `OAUTH2_OPENID_CONFIG_URL` is set in `.env.local`
2. MCP server can reach Azure AD (check network/firewall)
3. Azure AD tenant ID is correct

**Test upstream URL directly**:
```bash
curl https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/.well-known/openid-configuration
```

### ChatGPT Can't Connect

**Check**:
1. MCP server is publicly accessible
2. Firewall allows inbound HTTPS traffic
3. SSL certificate is valid (if using HTTPS)
4. Discovery URL returns valid JSON

### Token Verification Fails

**Check**:
1. Token audience matches `OAUTH2_AUDIENCE`
2. Token issuer matches `OAUTH2_ISSUER`
3. JWKS URI is accessible from MCP server

## Architecture

```
┌─────────────────────┐
│ ChatGPT Enterprise  │
│                     │
│ 1. Discover config  │────┐
│ 2. Get access token │    │
│ 3. Call MCP         │    │
└─────────────────────┘    │
                           │
                           ↓
              ┌────────────────────────┐
              │   MCP Server           │
              │   localhost:3001       │
              │                        │
              │  GET /.well-known/     │←─── Discovery
              │  openid-configuration  │
              │                        │
              │  POST /sse             │←─── MCP Protocol
              │  (+ OAuth2 token)      │     (with token)
              └────────────────────────┘
                           │
                           │ Fetches config
                           ↓
              ┌────────────────────────┐
              │   Azure AD             │
              │   login.microsoftonline│
              │                        │
              │  GET /.well-known/     │
              │  openid-configuration  │
              │                        │
              │  GET /discovery/keys   │
              └────────────────────────┘
```

## Benefits

✅ **Easy Integration**: ChatGPT Enterprise auto-discovers OAuth2 configuration  
✅ **Standard Compliant**: Uses OpenID Connect Discovery protocol  
✅ **Cached**: Configuration is cached for 1 hour for performance  
✅ **Flexible**: Works with any OAuth2 provider (Auth0, Okta, Azure AD, etc.)  
✅ **Transparent**: Proxies configuration from upstream provider  

## Next Steps

1. ✅ Configure Azure AD application for ChatGPT Enterprise
2. ✅ Test discovery endpoint locally
3. ✅ Deploy MCP server to production
4. ✅ Configure ChatGPT Enterprise with discovery URL
5. ✅ Test ChatGPT can call MCP actions
