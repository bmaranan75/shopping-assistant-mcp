# Test MCP Server with OAuth2 (Postman/curl)

## Your Configuration (Azure AD)

- **Tenant ID**: `b7f604a0-00a9-4188-9248-42f3a5aac2e9`
- **Audience**: `00000002-0000-0000-c000-000000000000` (Microsoft Graph)
- **JWKS URI**: `https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/discovery/v2.0/keys`
- **Issuer**: `https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/`

## Step 1: Obtain Access Token from Azure AD

### Using curl:

```bash
curl -X POST "https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=00000002-0000-0000-c000-000000000000/.default" \
  -d "grant_type=client_credentials"
```

### In Postman:

**Method**: POST  
**URL**: `https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token`

**Headers**:
- `Content-Type: application/x-www-form-urlencoded`

**Body** (x-www-form-urlencoded):
- `client_id`: YOUR_CLIENT_ID
- `client_secret`: YOUR_CLIENT_SECRET
- `scope`: `00000002-0000-0000-c000-000000000000/.default`
- `grant_type`: `client_credentials`

**Response** will contain:
```json
{
  "token_type": "Bearer",
  "expires_in": 3599,
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

Copy the `access_token` value.

---

## Step 2: Test MCP Health Endpoint (No Auth Required)

### Using curl:

```bash
curl -X GET "http://localhost:3001/health"
```

### In Postman:

**Method**: GET  
**URL**: `http://localhost:3001/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "safeway-shopping-assistant-mcp",
  "version": "1.0.0",
  "transport": "sse",
  "tools": ["search_products", "add_to_cart", "view_cart", "checkout", "add_payment_method", "get_deals"]
}
```

---

## Step 3: Test MCP SSE Endpoint with OAuth2 Token

### Using curl:

```bash
# Replace YOUR_ACCESS_TOKEN with the token from Step 1
curl -X POST "http://localhost:3001/sse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

### In Postman:

**Method**: POST  
**URL**: `http://localhost:3001/sse`

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_ACCESS_TOKEN` (replace with actual token)

**Body** (raw JSON):
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
}
```

**Expected Response**: 
- **Success (200)**: SSE connection established
- **Unauthorized (401)**: Token is invalid or expired

---

## Step 4: Test with User Token (Dual Token Pattern - Optional)

### Using curl:

```bash
curl -X POST "http://localhost:3001/sse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLIENT_ACCESS_TOKEN" \
  -H "X-User-Token: Bearer YOUR_USER_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

### In Postman:

**Method**: POST  
**URL**: `http://localhost:3001/sse`

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_CLIENT_ACCESS_TOKEN`
- `X-User-Token: Bearer YOUR_USER_ACCESS_TOKEN`

**Body**: Same as Step 3

---

## Troubleshooting

### 401 Unauthorized

**Check**:
1. Token is not expired (check `exp` claim)
2. Token has correct audience: `00000002-0000-0000-c000-000000000000`
3. Token issuer matches: `https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/`
4. MCP server is running on port 3001

**Decode token** at https://jwt.ms or https://jwt.io to inspect claims

### Token Expired

Tokens typically expire in 1 hour. Request a new token from Step 1.

### Connection Refused

Ensure MCP server is running:
```bash
cd /Users/bmara00/GithubPersonal/shopping-assistant-mcp
npm run dev
```

---

## Quick Test Script

Save this as `test-mcp.sh`:

```bash
#!/bin/bash

# Set your Azure AD credentials
CLIENT_ID="your-client-id"
CLIENT_SECRET="your-client-secret"
TENANT_ID="b7f604a0-00a9-4188-9248-42f3a5aac2e9"
SCOPE="00000002-0000-0000-c000-000000000000/.default"

echo "=== Getting Access Token ==="
TOKEN_RESPONSE=$(curl -s -X POST \
  "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=$SCOPE" \
  -d "grant_type=client_credentials")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "✓ Token obtained"
echo "Token preview: ${ACCESS_TOKEN:0:50}..."
echo ""

echo "=== Testing Health Endpoint ==="
curl -s http://localhost:3001/health | jq .
echo ""

echo "=== Testing SSE Endpoint with OAuth2 ==="
curl -X POST http://localhost:3001/sse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

Make it executable:
```bash
chmod +x test-mcp.sh
./test-mcp.sh
```

---

## Postman Collection

You can import this collection into Postman:

1. Create new collection: "MCP OAuth2 Tests"
2. Add environment variables:
   - `tenant_id`: `b7f604a0-00a9-4188-9248-42f3a5aac2e9`
   - `client_id`: YOUR_CLIENT_ID
   - `client_secret`: YOUR_CLIENT_SECRET
   - `scope`: `00000002-0000-0000-c000-000000000000/.default`
   - `mcp_url`: `http://localhost:3001`
3. Create requests as shown above
4. Use `{{access_token}}` variable in Authorization header
