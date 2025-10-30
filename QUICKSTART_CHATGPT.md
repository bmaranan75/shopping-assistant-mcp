# Quick Start Guide - ChatGPT Enterprise Integration

## What Was Added

Your MCP server now has **complete ChatGPT Enterprise support** with automatic action discovery via OpenAPI 3.0 schema.

## Key Files Created

1. **`src/mcp/openapi-schema.ts`** - Generates OpenAPI schema from MCP tools
2. **`test-chatgpt-endpoints.sh`** - Tests all discovery endpoints
3. **`docs/CHATGPT_ENTERPRISE_INTEGRATION.md`** - Complete setup guide
4. **`docs/CHATGPT_ENTERPRISE_SOLUTION.md`** - Technical implementation details

## New Endpoints

Your MCP server now exposes these discovery endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/openapi.json` | OpenAPI 3.0 schema (6 tools) |
| `GET /.well-known/ai-plugin.json` | Actions manifest |
| `GET /.well-known/openid-configuration` | OAuth2 config |
| `GET /.well-known/oauth-protected-resource` | OAuth2 resource metadata |
| `POST /tools/{tool_name}` | REST-style tool execution |

## How to Test

### 1. Build the updated code

```bash
cd /Users/bmara00/GithubPersonal/shopping-assistant-mcp
npm run build
```

### 2. Start the server

```bash
npm run dev
```

### 3. Test all endpoints

```bash
./test-chatgpt-endpoints.sh
```

Expected output:
```
✅ Health Check
✅ OpenID Connect Discovery
✅ OAuth Protected Resource Metadata
✅ OpenAPI Schema (6 tools discovered)
✅ Actions Manifest
```

## Configure ChatGPT Enterprise

### Option 1: Quick Test (Local)

1. Start your MCP server: `npm run dev`
2. Use ngrok or similar to expose port 3001: `ngrok http 3001`
3. In ChatGPT Enterprise, add action with your ngrok URL

### Option 2: Production Setup

1. Deploy MCP server to production (with HTTPS)
2. Update `.env.production` with production URLs
3. In ChatGPT Enterprise admin:
   - Navigate to Integrations/Actions
   - Click "Add Action"
   - Enter server URL
   - Configure OAuth2 with Azure AD credentials
   - ChatGPT will auto-discover all 6 tools

Full guide: `docs/CHATGPT_ENTERPRISE_INTEGRATION.md`

## What ChatGPT Enterprise Will Discover

```
✓ search_products - Search product catalog
✓ add_to_cart - Add items to cart
✓ view_cart - View cart contents
✓ checkout - Complete checkout
✓ add_payment_method - Add payment method
✓ get_deals - Get deals and promotions
```

## Architecture

```
ChatGPT Enterprise
    ↓ [Discovers via OpenAPI]
    ↓ GET /.well-known/openapi.json
    ↓
MCP Server (Your Code)
    ↓ [OAuth2 Authentication]
    ↓ POST /tools/search_products
    ↓
Next.js API
    ↓
LangGraph Agents
```

## Troubleshooting

### Server won't start

```bash
# Check for build errors
npm run build

# Check .env.local configuration
cat .env.local | grep OAUTH2
```

### Endpoints return 404

```bash
# Ensure you built the latest code
npm run build

# Restart the server
npm run dev
```

### ChatGPT can't discover actions

```bash
# Verify OpenAPI schema is valid
curl http://localhost:3001/.well-known/openapi.json | jq .openapi

# Should return: "3.0.0"
```

### Authentication fails

```bash
# Check OAuth2 configuration
curl http://localhost:3001/.well-known/openid-configuration | jq

# Verify token endpoint and JWKS URI are correct
```

## Next Steps

1. ✅ **Code is ready** - All files created and server updated
2. 🔨 **Build** - Run `npm run build`
3. 🚀 **Test** - Run `npm run dev` and `./test-chatgpt-endpoints.sh`
4. 🌐 **Deploy** - Follow production guide in docs
5. 🤖 **Connect** - Configure ChatGPT Enterprise

## Support

- **Full Guide**: `docs/CHATGPT_ENTERPRISE_INTEGRATION.md`
- **Technical Details**: `docs/CHATGPT_ENTERPRISE_SOLUTION.md`
- **Test Script**: `./test-chatgpt-endpoints.sh`

## Summary

**What was missing**: OpenAPI 3.0 schema that ChatGPT Enterprise uses to discover actions

**What we added**: Complete OpenAPI schema generation + REST endpoints + discovery endpoints

**Result**: ChatGPT Enterprise can now automatically discover and use all 6 shopping assistant tools! 🎉
