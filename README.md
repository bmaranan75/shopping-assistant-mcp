# Shopping Assistant - MCP Server

Model Context Protocol (MCP) server for the Shopping Assistant application. This server exposes AI agent capabilities to MCP clients like Claude Desktop.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI applications to seamlessly integrate with various data sources and tools. This MCP server exposes shopping assistant agents as tools that can be called from Claude Desktop or any other MCP-compatible client.

## Features

- **Catalog Agent**: Search and browse product catalog
- **Cart Agent**: Manage shopping cart operations
- **Deals Agent**: Find deals and promotions
- **Payment Agent**: Handle payment operations

## Architecture

```
┌─────────────────────┐
│   Claude Desktop    │
│   (MCP Client)      │
└──────────┬──────────┘
           │ MCP Protocol (SSE)
           ↓
┌─────────────────────┐
│   MCP Server        │
│   Port: 3001        │
└──────────┬──────────┘
           │ HTTP (SDK)
           ↓
┌─────────────────────┐
│   LangGraph Agents  │
│   Port: 2024        │
└─────────────────────┘
```

## Prerequisites

- Node.js 20+
- LangGraph agents server running (see shopping-assistant-agents repo)

## Installation

```bash
npm install
```

## Configuration

Create `.env.local` file:

```bash
# MCP Server
MCP_SERVER_PORT=3001

# LangGraph Agents (required)
LANGGRAPH_API_URL=http://localhost:2024

# Authentication Mode (choose one)
MCP_AUTH_MODE=oauth2  # Options: 'oauth2', 'api-key', 'hybrid', 'none'

# Generic OAuth2 Authentication (recommended - for MCP_AUTH_MODE=oauth2)
# The MCP server will verify OAuth2 access tokens from clients using standard JWT/JWKS

# Required: JWKS endpoint for public key verification
OAUTH2_JWKS_URI=https://your-auth-server/.well-known/jwks.json

# Optional: Verify token issuer (iss claim)
OAUTH2_ISSUER=https://your-auth-server/

# Optional: Verify token audience (aud claim)
OAUTH2_AUDIENCE=your-api-identifier

# Optional: Restrict which OAuth2 clients can access the MCP
ALLOWED_MCP_CLIENTS=client-id-1,client-id-2

# Optional: Require specific scopes
REQUIRED_MCP_SCOPES=mcp:read,mcp:execute

# Legacy API Key Authentication (for MCP_AUTH_MODE=api-key)
# Deprecated: Use OAuth2 for better security
MCP_API_KEY=your-secure-key

# External APIs (optional)
SAFEWAY_API_KEY=your-api-key
```

## Development

```bash
# Start MCP server
npm run dev

# The server will run on:
# SSE endpoint: http://localhost:3001/sse
# Health check: http://localhost:3001/health
```

## Testing with MCP Inspector

```bash
# Start the inspector
npm run mcp:inspect
```

This opens a web UI where you can test MCP tools interactively.

## Using with Claude Desktop

1. Start the MCP server: `npm run dev`

2. Update Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shopping-assistant": {
      "command": "node",
      "args": [
        "/path/to/shopping-assistant-mcp/dist/mcp/server.js"
      ],
      "env": {
        "LANGGRAPH_API_URL": "http://localhost:2024",
        "MCP_SERVER_PORT": "3001"
      }
    }
  }
}
```

3. Restart Claude Desktop

4. Available tools:
   - `catalog_search` - Search for products
   - `cart_view` - View shopping cart
   - `cart_add` - Add items to cart
   - `deals_search` - Find deals
   - `payment_add` - Add payment method

## Project Structure

```
shopping-assistant-mcp/
├── src/
│   ├── mcp/
│   │   ├── server.ts         # Main MCP server
│   │   ├── tools.ts          # MCP tool definitions
│   │   ├── auth.ts           # Authentication
│   │   └── handlers.ts       # Tool handlers
│   └── lib/                  # Shared utilities
├── package.json
├── tsconfig.json
└── README.md
```

## Production Deployment

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Docker

```bash
# Build
docker build -t shopping-assistant-mcp .

# Run
docker run -p 3001:3001 \
  -e LANGGRAPH_API_URL=http://agents:2024 \
  shopping-assistant-mcp
```

## API Endpoints

### Health Check
```bash
GET /health
```

### SSE Endpoint (MCP Protocol)
```bash
GET /sse
```

This is the main endpoint used by MCP clients to communicate with the server using Server-Sent Events.

## Security

### Authentication

The MCP server supports three authentication modes:

#### 1. OAuth2 Authentication (Recommended)

The server verifies OAuth2 access tokens using standard JWT/JWKS verification:

**How it works:**
1. Client obtains an access token from your OAuth2 provider
2. Client includes token in requests: `Authorization: Bearer <access_token>`
3. MCP server verifies the token signature using JWKS (public keys)
4. MCP server validates issuer, audience, expiration, and scopes
5. Optionally, client can include user token: `X-User-Token: Bearer <user_token>`

**Configuration:**
```bash
MCP_AUTH_MODE=oauth2

# Required: JWKS endpoint for token verification
OAUTH2_JWKS_URI=https://your-auth-server/.well-known/jwks.json

# Optional: Verify token issuer (iss claim)
OAUTH2_ISSUER=https://your-auth-server/

# Optional: Verify token audience (aud claim)
OAUTH2_AUDIENCE=your-api-identifier

# Optional: Whitelist allowed clients
ALLOWED_MCP_CLIENTS=client-id-1,client-id-2

# Optional: Require specific scopes
REQUIRED_MCP_SCOPES=mcp:read,mcp:execute
```

**Supported OAuth2 Providers:**
- **Auth0**: `OAUTH2_JWKS_URI=https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json`
- **Okta**: `OAUTH2_JWKS_URI=https://YOUR_DOMAIN.okta.com/oauth2/default/v1/keys`
- **Azure AD**: `OAUTH2_JWKS_URI=https://login.microsoftonline.com/TENANT_ID/discovery/v2.0/keys`
- **Keycloak**: `OAUTH2_JWKS_URI=https://YOUR_DOMAIN/auth/realms/REALM/protocol/openid-connect/certs`
- **Any OAuth2/OIDC provider** that publishes JWKS public keys

**Dual Token Pattern:**
- **Access Token (Required)**: Proves the calling application is authorized
- **User Token (Optional)**: Provides user context for personalized operations

Example request:
```bash
curl -X POST http://localhost:3001/sse \
  -H "Authorization: Bearer <client_access_token>" \
  -H "X-User-Token: Bearer <user_oauth_token>"
```

#### 2. API Key Authentication (Legacy)

Simple API key validation (deprecated, use OAuth2 instead):

```bash
MCP_AUTH_MODE=api-key
MCP_API_KEY=your-secure-key
```

Request header: `X-MCP-API-Key: your-secure-key`

#### 3. Hybrid Mode

Supports both OAuth2 and API key authentication:

```bash
MCP_AUTH_MODE=hybrid
```

The server will accept either OAuth2 tokens or API keys.

#### 4. No Authentication

Disable authentication (not recommended for production):

```bash
MCP_AUTH_MODE=none
```

### Setting Up OAuth2

The MCP server works with any OAuth2/OIDC provider. Here's how to configure common providers:

#### Any OAuth2 Provider (Generic Setup)

1. **Find your JWKS URI:**
   - Look for the `.well-known/jwks.json` or public keys endpoint
   - This is typically discoverable via `/.well-known/openid-configuration`

2. **Configure the MCP Server:**
   ```bash
   OAUTH2_JWKS_URI=https://your-provider/path/to/jwks.json
   OAUTH2_ISSUER=https://your-provider/  # Optional
   OAUTH2_AUDIENCE=your-api-id            # Optional
   ```

3. **Client obtains token using client credentials:**
   ```bash
   curl -X POST https://your-provider/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials" \
     -d "client_id=<client-id>" \
     -d "client_secret=<client-secret>" \
     -d "audience=<your-api-id>"  # If required
   ```

4. **Use token with MCP:**
   ```bash
   curl -X POST http://localhost:3001/sse \
     -H "Authorization: Bearer <access_token>"
   ```

#### Provider-Specific Examples

**Auth0:**
```bash
OAUTH2_JWKS_URI=https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json
OAUTH2_ISSUER=https://YOUR_DOMAIN.auth0.com/
OAUTH2_AUDIENCE=https://api.your-domain.com/mcp
```

**Azure AD (Microsoft Entra ID):**
```bash
OAUTH2_JWKS_URI=https://login.microsoftonline.com/YOUR_TENANT_ID/discovery/v2.0/keys
OAUTH2_ISSUER=https://sts.windows.net/YOUR_TENANT_ID/
# Or for v2 tokens: OAUTH2_ISSUER=https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0
OAUTH2_AUDIENCE=YOUR_APPLICATION_ID
```

**Okta:**
```bash
OAUTH2_JWKS_URI=https://YOUR_DOMAIN.okta.com/oauth2/default/v1/keys
OAUTH2_ISSUER=https://YOUR_DOMAIN.okta.com/oauth2/default
OAUTH2_AUDIENCE=api://default
```

**Keycloak:**
```bash
OAUTH2_JWKS_URI=https://YOUR_DOMAIN/auth/realms/YOUR_REALM/protocol/openid-connect/certs
OAUTH2_ISSUER=https://YOUR_DOMAIN/auth/realms/YOUR_REALM
OAUTH2_AUDIENCE=your-client-id
```

### CORS

CORS is configured to allow connections from:
- Claude Desktop
- Local development (localhost)

For production, configure `Access-Control-Allow-Origin` appropriately.

## Monitoring

### Logs

The server logs all requests and tool executions:

```bash
[MCP] Server starting...
[MCP] Available tools: catalog_search, cart_view, cart_add...
[MCP] Tool execution: catalog_search
[MCP] Success: Found 12 products
```

### LangSmith Tracing

Enable tracing for debugging:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_PROJECT=shopping-assistant-mcp
```

## Troubleshooting

### Server won't start
- Check if port 3001 is available
- Verify Node.js version (20+)
- Check .env configuration

### Tools not working
- Ensure LangGraph agents server is running (port 2024)
- Verify LANGGRAPH_API_URL in .env
- Check network connectivity

### Claude Desktop can't connect
- Verify server is running: `curl http://localhost:3001/health`
- Check Claude Desktop config path
- Restart Claude Desktop after config changes

## Related Repositories

- **shopping-assistant-agents**: LangGraph agents implementation
- **shopping-assistant-chat**: Next.js web interface

## License

MIT
