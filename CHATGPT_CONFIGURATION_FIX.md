# ChatGPT Enterprise Configuration Fix

## Problem Identified ✅

Your logs show:
```
[MCP Server] Authentication successful
[MCP Server] SSE connection established
[MCP Server] tools/list called: NO ❌
```

**Root Cause**: ChatGPT Enterprise is connecting to the **MCP SSE endpoint** (`/sse`) instead of using the **OpenAPI discovery flow**.

ChatGPT Enterprise **does NOT use MCP protocol**. It uses **OpenAPI 3.0 + REST**.

## Solution

### What's Happening Now (WRONG) ❌
```
ChatGPT Enterprise → http://your-server:3001/sse
                     (MCP SSE endpoint - used by Claude Desktop, not ChatGPT)
```

### What Should Happen (CORRECT) ✅
```
ChatGPT Enterprise → http://your-server:3001/.well-known/openapi.json
                     (OpenAPI schema - lists all available actions)
                  ↓
ChatGPT Enterprise → http://your-server:3001/tools/{tool_name}
                     (REST endpoints - execute actions)
```

## How to Fix in ChatGPT Enterprise

### Step 1: Remove the current MCP connection

In ChatGPT Enterprise admin panel:
1. Go to **Settings** → **Actions** or **Custom GPTs**
2. Find your "Safeway Shopping Assistant" connection
3. **Delete** or **Disconnect** it

### Step 2: Add as OpenAPI/REST Action

In ChatGPT Enterprise:
1. Click **"Add Action"** or **"Import from URL"**
2. Use this URL: `http://your-server-host:3001/.well-known/openapi.json`
3. ChatGPT will fetch the OpenAPI schema and discover all 6 tools automatically

### Step 3: Configure OAuth2 Authentication

When ChatGPT prompts for authentication:
1. **Authentication Type**: OAuth2 Client Credentials
2. **Token URL**: `https://login.microsoftonline.com/{your-tenant-id}/oauth2/v2.0/token`
3. **Client ID**: Your Azure AD client ID
4. **Client Secret**: Your Azure AD client secret
5. **Scope**: `{your-audience}/.default` (e.g., `00000002-0000-0000-c000-000000000000/.default`)

## Expected Behavior After Fix

Once configured correctly, you should see logs like:
```
[MCP Server] GET /.well-known/openapi.json
[MCP Server] Returning OpenAPI schema with 6 tools
[MCP Server] POST /tools/search_products
[MCP Server] Executing tool: search_products
```

**NOT** this:
```
[MCP Server] SSE connection established  ← This is for MCP clients only (Claude)
[MCP Server] tools/list called: NO       ← ChatGPT doesn't use MCP protocol
```

## Testing the OpenAPI Endpoint

Test that your OpenAPI schema is accessible:

```bash
# Should return a JSON schema with all 6 tools
curl http://localhost:3001/.well-known/openapi.json
```

Expected output:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Safeway Shopping Assistant",
    "version": "1.0.0"
  },
  "paths": {
    "/tools/search_products": { ... },
    "/tools/add_to_cart": { ... },
    "/tools/view_cart": { ... },
    "/tools/checkout": { ... },
    "/tools/add_payment_method": { ... },
    "/tools/get_deals": { ... }
  }
}
```

## Key Differences

| Feature | MCP Protocol | OpenAPI/REST (ChatGPT) |
|---------|-------------|------------------------|
| **Endpoint** | `/sse` | `/.well-known/openapi.json` |
| **Transport** | Server-Sent Events (SSE) | HTTP REST |
| **Discovery** | `tools/list` JSON-RPC call | OpenAPI schema fetch |
| **Tool Execution** | JSON-RPC over SSE | POST to `/tools/{name}` |
| **Used By** | Claude Desktop, MCP clients | ChatGPT Enterprise, OpenAI |

## Current Server Status ✅

Your server **already supports both**:
- ✅ MCP protocol (for Claude Desktop) → `/sse` endpoint
- ✅ OpenAPI/REST (for ChatGPT Enterprise) → `/.well-known/openapi.json`

You just need to configure ChatGPT Enterprise to use the **OpenAPI endpoint** instead of the **MCP endpoint**.

## Summary

**The server is working correctly!** The issue is in how you configured ChatGPT Enterprise.

**Action Required**: 
1. In ChatGPT Enterprise, **delete the current connection** (it's using MCP protocol)
2. **Add a new action** using the OpenAPI schema URL: `http://your-host:3001/.well-known/openapi.json`
3. Configure OAuth2 as shown above

Once you do this, ChatGPT will discover all 6 tools and you'll see REST calls to `/tools/*` in your logs instead of SSE connections.
