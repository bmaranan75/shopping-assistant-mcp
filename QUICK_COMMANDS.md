# Quick Command Reference - ChatGPT Enterprise Setup

## Test Your Server is Ready

```bash
# 1. Check server is running
curl http://localhost:3001/health

# 2. Verify OpenAPI schema is accessible
curl http://localhost:3001/.well-known/openapi.json | jq '.paths | keys'

# Expected output:
# [
#   "/tools/add_payment_method",
#   "/tools/add_to_cart",
#   "/tools/checkout",
#   "/tools/get_deals",
#   "/tools/search_products",
#   "/tools/view_cart"
# ]

# 3. Get your Azure AD OAuth2 configuration
echo "Token URL: https://login.microsoftonline.com/$(grep OAUTH2_ISSUER .env.local | cut -d'/' -f4)/oauth2/v2.0/token"
echo "Audience: $(grep OAUTH2_AUDIENCE .env.local | cut -d'=' -f2)"
```

## ChatGPT Enterprise Configuration

### Step 1: Get OpenAPI Schema URL
```bash
# If running locally (for testing)
echo "http://localhost:3001/.well-known/openapi.json"

# If deployed publicly
echo "http://YOUR_PUBLIC_IP:3001/.well-known/openapi.json"

# If using ngrok for testing
ngrok http 3001
# Use the URL shown: https://abc123.ngrok.io/.well-known/openapi.json
```

### Step 2: Configure in ChatGPT Enterprise

**Go to**: ChatGPT Enterprise Admin Panel → Actions

**Click**: "Create new action" or "Import from URL"

**Enter**:
- URL: `http://YOUR_SERVER:3001/.well-known/openapi.json`
- Click "Import" or "Fetch schema"

**Configure OAuth2**:
- Authentication Type: `OAuth 2.0 Client Credentials`
- Token URL: `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
- Client ID: `{YOUR_CLIENT_ID}`
- Client Secret: `{YOUR_CLIENT_SECRET}`
- Scope: `00000002-0000-0000-c000-000000000000/.default`

### Step 3: Verify It Works

**In your server logs, you should see**:
```
[MCP Server] GET /.well-known/openapi.json
[MCP Server] OpenAPI schema request
```

**When you use an action in ChatGPT**:
```
[MCP Server] POST /tools/search_products
[MCP Server] Executing tool: search_products
[MCP Server] Tool search_products completed successfully
```

**NOT this** (this means you're still using MCP/SSE):
```
[MCP Server] SSE connection established
[MCP Server] tools/list called: NO ❌
```

## Troubleshooting Commands

```bash
# Check if port 3001 is accessible
nc -zv localhost 3001

# Test OpenAPI endpoint directly
curl -v http://localhost:3001/.well-known/openapi.json

# Test tool execution (with OAuth2 token)
TOKEN="your-oauth2-token-here"
curl -X POST http://localhost:3001/tools/search_products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "milk", "limit": 5}'

# Get an OAuth2 token for testing
curl -X POST "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "scope=00000002-0000-0000-c000-000000000000/.default"

# Watch server logs in real-time
tail -f logs/mcp-server.log  # or wherever your logs are
```

## Environment Variables Needed

```bash
# In your .env.local file
MCP_AUTH_MODE=oauth2
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=3001

OAUTH2_JWKS_URI=https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys
OAUTH2_ISSUER=https://sts.windows.net/{TENANT_ID}/
OAUTH2_AUDIENCE=00000002-0000-0000-c000-000000000000
OAUTH2_TOKEN_ENDPOINT=https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token
```

## Quick Test Script

Save this as `test-chatgpt-config.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Verifying ChatGPT Enterprise Setup..."
echo ""

# Test 1: Health check
echo "1️⃣  Health Check"
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is not accessible"
    exit 1
fi

# Test 2: OpenAPI schema
echo "2️⃣  OpenAPI Schema"
if curl -sf http://localhost:3001/.well-known/openapi.json > /dev/null; then
    tool_count=$(curl -s http://localhost:3001/.well-known/openapi.json | jq '.paths | length')
    echo "   ✅ OpenAPI schema accessible"
    echo "   ✅ Contains $tool_count tool endpoints"
else
    echo "   ❌ OpenAPI schema not accessible"
    exit 1
fi

# Test 3: Tool paths
echo "3️⃣  Available Tools"
curl -s http://localhost:3001/.well-known/openapi.json | jq -r '.paths | keys[]' | while read path; do
    echo "   ✅ $path"
done

echo ""
echo "🎉 Server is ready for ChatGPT Enterprise!"
echo ""
echo "📝 Next step: Import this URL in ChatGPT Enterprise:"
echo "   http://$(hostname):3001/.well-known/openapi.json"
```

Make executable and run:
```bash
chmod +x test-chatgpt-config.sh
./test-chatgpt-config.sh
```

## Summary

**The only thing you need to do**:
1. Open ChatGPT Enterprise settings
2. Add new action → Import from URL
3. Use: `http://your-server:3001/.well-known/openapi.json`
4. Configure OAuth2 with your Azure AD credentials

That's it! Your server is already perfect. 🚀
