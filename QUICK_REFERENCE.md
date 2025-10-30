# 🚀 Quick Reference: Debugging ChatGPT + MCP Tools Discovery

## Start Server
```bash
npm run dev

# OR without auth for testing:
MCP_AUTH_MODE=none npm run dev
```

## What to Watch in Logs

### ✅ GOOD - Tools will work:
```
[MCP Server] New SSE connection attempt
[MCP Server] Authentication successful
[MCP Server] SSE connection established
[MCP Server] ✅ tools/list CALLED
[MCP Server] Returning 6 tools
```

### ❌ BAD - OAuth2 issue:
```
[MCP Server] New SSE connection attempt
[MCP Server] Authentication failed: No valid authentication provided
```
**Fix:** Configure Azure AD OAuth2 (see NEXT_STEPS.md → Fix #1)

### ❌ BAD - ChatGPT never calls tools/list:
```
[MCP Server] New SSE connection attempt
[MCP Server] Authentication successful
[MCP Server] SSE connection established
[After 30 seconds]
[MCP Server] Protocol Call Status:
  - tools/list called: NO ❌
```
**Fix:** ChatGPT might be configured for OpenAPI not MCP (see NEXT_STEPS.md → Fix #2)

### ❌ BAD - No connection at all:
```
[After 30 seconds]
[MCP Server] Protocol Call Status:
  - tools/list called: NO ❌
```
(No "New SSE connection attempt")

**Fix:** Network/firewall issue (see NEXT_STEPS.md → Fix #3)

## Quick Tests

### Test 1: Is server running?
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"healthy","service":"safeway-shopping-assistant-mcp","tools":[...]}`

### Test 2: Can connect without auth?
```bash
# Terminal 1:
MCP_AUTH_MODE=none npm run dev

# Terminal 2:
node test-mcp-protocol.cjs
```
Expected: See "tools/list CALLED" in Terminal 1

### Test 3: Check OAuth2 config
```bash
# Verify environment variables are set:
echo $OAUTH2_JWKS_URI
echo $OAUTH2_ISSUER
echo $OAUTH2_AUDIENCE
```
Expected: All should print values, not empty

## ChatGPT Configuration

### Correct (MCP Protocol):
```json
{
  "mcpServers": {
    "safeway-shopping-assistant": {
      "url": "https://your-server:3001/sse",
      "transport": "sse",
      "auth": {
        "type": "oauth2",
        "flow": "client_credentials",
        "tokenUrl": "https://login.microsoftonline.com/YOUR_TENANT/oauth2/v2.0/token",
        "clientId": "YOUR_CLIENT_ID",
        "clientSecret": "YOUR_CLIENT_SECRET",
        "scope": "api://YOUR_APP_ID/.default"
      }
    }
  }
}
```

### Common Mistakes:
- ❌ Using `http://localhost:3001` when ChatGPT is remote
- ❌ Missing `/.default` at end of scope
- ❌ Wrong tenant ID in tokenUrl
- ❌ Using OpenAPI type instead of MCP
- ❌ Wrong OAUTH2_AUDIENCE in server .env

## Files to Check

- `NEXT_STEPS.md` - Detailed troubleshooting guide
- `DIAGNOSIS.md` - In-depth problem analysis  
- `.env.local` - OAuth2 configuration
- Server logs - Real-time diagnostic output

## Get Help

1. Start server: `npm run dev`
2. Connect ChatGPT
3. Wait 60 seconds  
4. Save logs: `npm run dev 2>&1 | tee debug.log`
5. Share `debug.log` for analysis

---
**Remember:** The #1 issue is usually OAuth2 authentication!
