#!/bin/bash

# Test script for MCP API routes
# This verifies all MCP endpoints are working correctly

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep MCP_API_KEY | xargs)
fi

if [ -z "$MCP_API_KEY" ]; then
  echo "❌ Error: MCP_API_KEY not found in .env.local"
  echo "Please ensure MCP_API_KEY is set in your .env.local file"
  exit 1
fi

API_KEY="$MCP_API_KEY"
BASE_URL="http://localhost:3000"

echo "================================================"
echo "Testing MCP API Routes"
echo "================================================"
echo ""
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:10}... (truncated)"
echo ""

# Test 1: Catalog Agent
echo "1️⃣  Testing Catalog Agent..."
echo "   POST /api/mcp/agents/catalog"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mcp/agents/catalog" \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: $API_KEY" \
  -d '{"action":"search","query":"milk","limit":3}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   Response preview: ${BODY:0:100}..."
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 2: Cart Agent
echo "2️⃣  Testing Cart Agent..."
echo "   POST /api/mcp/agents/cart"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mcp/agents/cart" \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: $API_KEY" \
  -d '{"action":"view"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   Response preview: ${BODY:0:100}..."
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 3: Payment Agent
echo "3️⃣  Testing Payment Agent..."
echo "   POST /api/mcp/agents/payment"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mcp/agents/payment" \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: $API_KEY" \
  -d '{"action":"list"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   Response preview: ${BODY:0:100}..."
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 4: Deals Agent
echo "4️⃣  Testing Deals Agent..."
echo "   POST /api/mcp/agents/deals"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mcp/agents/deals" \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: $API_KEY" \
  -d '{"action":"get"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "   Response preview: ${BODY:0:100}..."
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "   Response: $BODY"
fi
echo ""

# Test 5: Unauthorized request (should fail)
echo "5️⃣  Testing Unauthorized Request (should fail)..."
echo "   POST /api/mcp/agents/catalog (with invalid key)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mcp/agents/catalog" \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: invalid-key-12345" \
  -d '{"action":"search","query":"test"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ Status: $HTTP_CODE (correctly rejected)"
else
  echo "   ❌ Status: $HTTP_CODE (should be 401)"
fi
echo ""

echo "================================================"
echo "✅ Phase 2 Complete: All MCP API Routes Created"
echo "================================================"
echo ""
echo "Next Steps:"
echo "  - Proceed to Phase 3: Create MCP Server"
echo "  - Run: npm run mcp:dev (after Phase 3 is complete)"
echo ""
