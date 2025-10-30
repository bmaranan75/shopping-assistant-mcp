# MCP Server Diagnosis - Tools Discovery Issue

## 🎯 FINDINGS

### ✅ What's Working

1. **Server Starts Successfully**
   - MCP protocol version: `2025-06-18` (current)
   - Server advertises tools capability: `{ tools: true }`
   - All 6 tools loaded: `search_products`, `add_to_cart`, `view_cart`, `checkout`, `add_payment_method`, `get_deals`
   
2. **Health Endpoint Working**
   ```bash
   GET /health
   Response: {
     "status": "healthy",
     "service": "safeway-shopping-assistant-mcp",
     "tools": ["search_products", "add_to_cart", "view_cart", "checkout", "add_payment_method", "get_deals"]
   }
   ```

3. **SSE Connection Established**
   - When auth is disabled (`MCP_AUTH_MODE=none`), connections succeed
   - Server logs show: "SSE connection established"

4. **Protocol Handshake Compliant**
   - Server responds to `initialize` request
   - Protocol version negotiation works
   - Tools capability advertised in response

### ❌ What's NOT Working

**ChatGPT Enterprise doesn't discover tools despite connecting successfully**

## 🔍 ROOT CAUSE ANALYSIS

### Theory 1: OAuth2 Authentication Issue ⭐️ MOST LIKELY
ChatGPT Enterprise cannot authenticate with your Azure AD:

**Evidence:**
- When OAuth2 is enabled, test gets `401 Unauthorized`
- Server logs: "Authentication failed: No valid authentication provided"
- ChatGPT shows "connected" but no actions = authenticated but can't call tools/list

**Why This Happens:**
1. ChatGPT Enterprise needs to obtain an OAuth2 token from Azure AD
2. Your server requires a valid JWT from Azure AD tenant: `b7f604a0-00a9-4188-9248-42f3a5aac2e9`
3. ChatGPT might not be configured with the correct:
   - Client ID
   - Client Secret  
   - Token endpoint
   - Scopes

**Fix:**
```bash
# In ChatGPT Enterprise MCP configuration, you need:
{
  "mcpServers": {
    "safeway-shopping-assistant": {
      "url": "http://your-server:3001/sse",
      "transport": "sse",
      "auth": {
        "type": "oauth2",
        "tokenUrl": "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token",
        "clientId": "YOUR_AZURE_CLIENT_ID",
        "clientSecret": "YOUR_AZURE_CLIENT_SECRET",
        "scope": "YOUR_API_SCOPE"
      }
    }
  }
}
```

### Theory 2: OpenAPI Schema vs MCP Protocol Mismatch
ChatGPT Enterprise might be looking for REST endpoints (OpenAPI) rather than MCP SSE protocol:

**Evidence:**
- We added OpenAPI schema endpoints: `/.well-known/openapi.json`, `/tools/{tool_name}`
- ChatGPT Enterprise documentation mentions both MCP and OpenAPI support
- MCP uses SSE + JSON-RPC, OpenAPI uses REST + HTTP

**Possible Issue:**
If ChatGPT is configured to use OpenAPI actions (not MCP), it would:
1. Fetch `/.well-known/openapi.json` ✅ (this works)
2. Try to execute tools via `POST /tools/{tool_name}` ✅ (this works)
3. But never call MCP's `tools/list` via SSE ❌ (so no tools discovered via MCP protocol)

**Fix:**
Make sure ChatGPT is configured to use **MCP protocol**, not OpenAPI actions.

### Theory 3: SSE Transport Issue
ChatGPT's MCP client might have issues with SSE transport:

**Evidence:**
- SSE keeps connection open (our test hangs because SSE doesn't close)
- ChatGPT might timeout waiting for complete response
- SSE requires proper message framing with `data:` prefix

**Server Uses SSE Correctly:**
```typescript
// From server.ts line 374-377:
const transport = new SSEServerTransport('/message', res);
await server.connect(transport);
```

The MCP SDK handles SSE formatting, so this should work.

### Theory 4: tools/list Not Called or Returns Empty
ChatGPT connects but never calls `tools/list`, or the method returns empty:

**Evidence:**
We added logging to `tools/list` handler:
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[MCP Server] tools/list request received'); // ← Check if this appears in logs
  console.error(`[MCP Server] Returning ${toolsList.length} tools`);
  return { tools: toolsList };
});
```

**What to Check:**
1. Do you see "tools/list request received" in server logs when ChatGPT connects?
2. If NO → ChatGPT isn't calling tools/list (authentication or handshake issue)
3. If YES → Check if "Returning 6 tools" also appears
4. If tools returned but ChatGPT shows none → format issue

## 🛠️ DEBUGGING STEPS

### Step 1: Check Server Logs When ChatGPT Connects

**Expected logs:**
```
[MCP Server] New SSE connection attempt
[MCP Server] Authentication successful  ← Should see this
[MCP Server] SSE connection established
[MCP Server] tools/list request received  ← Should see this
[MCP Server] Returning 6 tools  ← Should see this
```

**If you see:**
- "Authentication failed" → OAuth2 configuration issue (Theory 1)
- No "tools/list request received" → ChatGPT not calling the method
- "Returning 6 tools" but ChatGPT shows none → Response format issue

### Step 2: Test Local MCP Client

Use MCP Inspector or Claude Desktop (which definitely works with MCP):

```bash
# Clone MCP Inspector
git clone https://github.com/modelcontextprotocol/inspector
cd inspector
npm install
npm run dev

# Configure it to connect to http://localhost:3001/sse with auth disabled
# Set MCP_AUTH_MODE=none when starting your server for this test
```

If Claude Desktop/MCP Inspector discovers tools → Your server is fine, ChatGPT config is wrong
If they don't → Server protocol implementation issue

### Step 3: Test with Authentication Disabled

Temporarily set `MCP_AUTH_MODE=none` and configure ChatGPT to connect without auth:

```bash
MCP_AUTH_MODE=none npm run dev
```

If tools appear → OAuth2 authentication is the problem
If tools still don't appear → Protocol or transport issue

### Step 4: Capture Network Traffic

Use Wireshark or tcpdump to see exactly what ChatGPT sends:

```bash
# On macOS:
sudo tcpdump -i lo0 -A 'port 3001' -w chatgpt-mcp.pcap

# Then connect ChatGPT and analyze the capture
```

Look for:
- Is `initialize` request sent?
- Is `tools/list` request sent?
- What's in the Authorization header?
- Any error responses?

### Step 5: Check ChatGPT Enterprise Configuration

In ChatGPT Enterprise admin panel, verify:

1. **MCP Server Configuration:**
   ```json
   {
     "url": "http://your-server:3001/sse",
     "transport": "sse"
   }
   ```

2. **OAuth2 Configuration:**
   - Token URL must match Azure AD tenant
   - Client credentials must be valid
   - Scope must match what your API expects

3. **Action vs MCP Mode:**
   - Make sure it's configured as "MCP Server", not "OpenAPI Actions"
   - If it's "OpenAPI Actions", it won't use SSE/tools/list

## 📋 RECOMMENDED FIXES

### Fix #1: Verify OAuth2 Configuration (HIGHEST PRIORITY)

**In Azure AD:**
1. Register a new app registration for ChatGPT Enterprise
2. Create a client secret
3. Expose an API scope (e.g., `api://your-app-id/user_impersonation`)
4. Grant admin consent for the scope

**In ChatGPT Enterprise:**
1. Configure OAuth2 client credentials:
   - Token URL: `https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token`
   - Client ID: From Azure app registration
   - Client Secret: From Azure app registration
   - Scope: The API scope you exposed

**In Your Server:**
Update `.env.local`:
```bash
# These must match what ChatGPT sends
OAUTH2_JWKS_URI=https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/discovery/v2.0/keys
OAUTH2_ISSUER=https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/
OAUTH2_AUDIENCE=api://your-app-id  # ← Must match Azure AD app ID
```

### Fix #2: Add More Detailed Logging

Add logging to every MCP protocol method to see what ChatGPT calls:

```typescript
// In server.ts, add these logs:

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const startTime = Date.now();
  console.error('[MCP Server] === tools/list START ===');
  console.error(`[MCP Server] Timestamp: ${new Date().toISOString()}`);
  
  const toolsList = mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  
  console.error(`[MCP Server] Returning ${toolsList.length} tools:`);
  toolsList.forEach((tool, i) => {
    console.error(`  ${i + 1}. ${tool.name} - ${tool.description}`);
  });
  console.error(`[MCP Server] === tools/list END (${Date.now() - startTime}ms) ===`);
  
  return { tools: toolsList };
});
```

### Fix #3: Add tools/list Call Tracking

Track if ChatGPT ever calls tools/list:

```typescript
// Add at top of server.ts
let toolsListCalled = false;
let initializeCalled = false;

server.setRequestHandler(InitializeRequestSchema, async (request) => {
  initializeCalled = true;
  console.error('[MCP Server] ✅ initialize CALLED');
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: {
      name: 'safeway-shopping-assistant',
      version: '1.0.0'
    }
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  toolsListCalled = true;
  console.error('[MCP Server] ✅ tools/list CALLED');
  // ... rest of handler
});

// Add periodic status check
setInterval(() => {
  console.error('[MCP Server] Status check:');
  console.error(`  - initialize called: ${initializeCalled ? 'YES ✅' : 'NO ❌'}`);
  console.error(`  - tools/list called: ${toolsListCalled ? 'YES ✅' : 'NO ❌'}`);
}, 10000); // Every 10 seconds
```

### Fix #4: Provide Both MCP and OpenAPI

Since we're not sure which protocol ChatGPT Enterprise is using, support both:

**MCP Protocol (SSE):** ✅ Already implemented  
**OpenAPI REST:** ✅ Already implemented

Both are working in your server. The issue is ChatGPT isn't calling either one.

## 🎯 NEXT ACTIONS

**Immediate (Do These First):**
1. ✅ Check server logs when ChatGPT connects - look for "tools/list request received"
2. ✅ Verify OAuth2 token acquisition - check if ChatGPT has correct Azure AD credentials
3. ✅ Test with `MCP_AUTH_MODE=none` to isolate auth vs protocol issues

**Short-term:**
4. Test with MCP Inspector or Claude Desktop to verify server works with other MCP clients
5. Capture network traffic to see what ChatGPT actually sends
6. Add detailed logging to track initialize and tools/list calls

**Long-term:**
7. Set up proper Azure AD app registration with correct scopes
8. Configure ChatGPT Enterprise with correct OAuth2 credentials
9. Document the working configuration for future reference

## 📚 REFERENCES

- MCP Protocol Spec: https://spec.modelcontextprotocol.io/
- Azure AD OAuth2: https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow
- Your OpenAPI schema: http://localhost:3001/.well-known/openapi.json
- Your health check: http://localhost:3001/health

## ❓ QUESTIONS TO ANSWER

1. **Do you see "tools/list request received" in server logs when ChatGPT connects?**
   - YES → Server is working, check response format
   - NO → ChatGPT isn't calling tools/list, check handshake or auth

2. **Does ChatGPT show any error messages in its UI?**
   - "Unauthorized" → OAuth2 config wrong
   - "Connection failed" → Network or SSL issue
   - "No actions available" → tools/list not called or returned empty

3. **Which ChatGPT configuration are you using?**
   - MCP Server (SSE transport) → Should call tools/list
   - OpenAPI Actions (REST) → Should use /tools/{tool_name} endpoints
   
4. **Can you access http://localhost:3001/.well-known/openapi.json from ChatGPT's network?**
   - If ChatGPT is hosted externally, it can't reach localhost
   - Need to deploy server to public URL or use ngrok

---

**Created:** $(date)  
**Status:** 🔴 Tools not discovered by ChatGPT Enterprise  
**Priority:** ⭐️⭐️⭐️ HIGH - Blocking production use
