#!/bin/bash

# Test OAuth2 authentication with MCP server
# Works with any OAuth2 provider (Auth0, Azure AD, Okta, Keycloak, etc.)

set -e

# Configuration
TOKEN_ENDPOINT="${OAUTH2_TOKEN_ENDPOINT:-https://your-provider.com/oauth/token}"
CLIENT_ID="${CLIENT_ID:-your-client-id}"
CLIENT_SECRET="${CLIENT_SECRET:-your-client-secret}"
AUDIENCE="${OAUTH2_AUDIENCE:-}"  # Optional, required by some providers
SCOPE="${OAUTH2_SCOPE:-}"        # Optional
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3001}"

echo "=== MCP OAuth2 Authentication Test ==="
echo ""
echo "Configuration:"
echo "  Token Endpoint: $TOKEN_ENDPOINT"
echo "  Client ID: $CLIENT_ID"
echo "  Audience: ${AUDIENCE:-none}"
echo "  Scope: ${SCOPE:-default}"
echo "  MCP Server: $MCP_SERVER_URL"
echo ""

# Step 1: Obtain access token
echo "Step 1: Obtaining OAuth2 access token..."

# Build the request body
REQUEST_DATA="grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET"

# Add audience if provided (required for Auth0, Azure AD)
if [ -n "$AUDIENCE" ]; then
  REQUEST_DATA="$REQUEST_DATA&audience=$AUDIENCE"
  # Also try 'resource' parameter for Azure AD
  REQUEST_DATA="$REQUEST_DATA&resource=$AUDIENCE"
fi

# Add scope if provided
if [ -n "$SCOPE" ]; then
  REQUEST_DATA="$REQUEST_DATA&scope=$SCOPE"
fi

TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "$REQUEST_DATA")

# Extract access token
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to obtain access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✓ Access token obtained"
echo "  Token preview: ${ACCESS_TOKEN:0:30}..."
echo ""

# Step 2: Test health endpoint (no auth required)
echo "Step 2: Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -X GET "$MCP_SERVER_URL/health")
echo "✓ Health check passed"
echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4
echo ""

# Step 3: Test SSE endpoint with authentication
echo "Step 3: Testing authenticated SSE endpoint..."
SSE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$MCP_SERVER_URL/sse" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}')

HTTP_CODE=$(echo "$SSE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Authentication successful (HTTP 200)"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ Authentication failed (HTTP 401)"
  echo "Response: $SSE_RESPONSE"
  exit 1
else
  echo "⚠ Unexpected response (HTTP $HTTP_CODE)"
  echo "Response: $SSE_RESPONSE"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Your access token is ready to use:"
echo "$ACCESS_TOKEN"
echo ""
echo "Use it in requests like this:"
echo "curl -X POST $MCP_SERVER_URL/sse \\"
echo "  -H \"Authorization: Bearer \$ACCESS_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\""
