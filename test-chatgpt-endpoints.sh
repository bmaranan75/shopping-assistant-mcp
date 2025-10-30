#!/bin/bash

# Test script for ChatGPT Enterprise integration endpoints
# This verifies all required discovery endpoints are working

set -e

MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3001}"

echo "================================================"
echo "Testing ChatGPT Enterprise Integration Endpoints"
echo "================================================"
echo ""
echo "Server URL: $MCP_SERVER_URL"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
echo "   GET $MCP_SERVER_URL/health"
RESPONSE=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 2: OpenID Connect Discovery
echo "2️⃣  Testing OpenID Connect Discovery..."
echo "   GET $MCP_SERVER_URL/.well-known/openid-configuration"
RESPONSE=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/.well-known/openid-configuration")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "$BODY" | jq '{issuer, token_endpoint, jwks_uri, grant_types_supported}' 2>/dev/null || echo "$BODY"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 3: OAuth Protected Resource Metadata
echo "3️⃣  Testing OAuth Protected Resource Metadata..."
echo "   GET $MCP_SERVER_URL/.well-known/oauth-protected-resource"
RESPONSE=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/.well-known/oauth-protected-resource")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 4: OpenAPI Schema (NEW - Critical for ChatGPT Enterprise)
echo "4️⃣  Testing OpenAPI Schema..."
echo "   GET $MCP_SERVER_URL/.well-known/openapi.json"
RESPONSE=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/.well-known/openapi.json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   OpenAPI Version:" $(echo "$BODY" | jq -r '.openapi' 2>/dev/null || echo "unknown")
  echo "   Title:" $(echo "$BODY" | jq -r '.info.title' 2>/dev/null || echo "unknown")
  echo "   Available Paths:"
  echo "$BODY" | jq -r '.paths | keys[]' 2>/dev/null | sed 's/^/     - /' || echo "     (could not parse)"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 5: Actions Manifest (NEW - for ChatGPT Enterprise)
echo "5️⃣  Testing Actions Manifest..."
echo "   GET $MCP_SERVER_URL/.well-known/ai-plugin.json"
RESPONSE=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/.well-known/ai-plugin.json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   Name:" $(echo "$BODY" | jq -r '.name_for_human' 2>/dev/null || echo "unknown")
  echo "   Auth Type:" $(echo "$BODY" | jq -r '.auth.type' 2>/dev/null || echo "unknown")
  echo "   API Type:" $(echo "$BODY" | jq -r '.api.type' 2>/dev/null || echo "unknown")
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

echo "================================================"
echo "✅ All Discovery Endpoints Tested"
echo "================================================"
echo ""
echo "📝 ChatGPT Enterprise Setup Instructions:"
echo ""
echo "1. In ChatGPT Enterprise, go to Actions/Integrations"
echo "2. Add a new Action with:"
echo "   - Server URL: $MCP_SERVER_URL"
echo "   - Authentication: OAuth2 Client Credentials"
echo "   - Token URL: (from OpenID Discovery)"
echo "   - Client ID: Your Azure AD Client ID"
echo "   - Client Secret: Your Azure AD Client Secret"
echo ""
echo "3. ChatGPT Enterprise will:"
echo "   - Discover OAuth config from /.well-known/openid-configuration"
echo "   - Discover actions from /.well-known/openapi.json"
echo "   - Obtain access token using client credentials"
echo "   - Call your MCP tools via /tools/{tool_name}"
echo ""
echo "4. Available Tools:"
echo "   - search_products: Search product catalog"
echo "   - add_to_cart: Add items to cart"
echo "   - view_cart: View cart contents"
echo "   - checkout: Complete checkout"
echo "   - add_payment_method: Add payment method"
echo "   - get_deals: Get current deals"
echo ""
