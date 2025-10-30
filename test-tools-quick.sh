#!/bin/bash

echo "🔍 Quick MCP Tools Test"
echo ""
echo "Testing if MCP server returns tools..."
echo ""

# Test 1: Health check
echo "1️⃣ Health Check:"
curl -s http://localhost:3001/health | jq '.'
echo ""

# Test 2: Send initialize + tools/list via HTTP
# Note: SSE protocol makes this tricky, but we can at least verify the endpoint responds
echo "2️⃣ SSE Endpoint Test:"
echo "Sending initialize request..."

# Create a JSON-RPC initialize request
INIT_REQUEST='{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'

# Send it to the SSE endpoint
RESPONSE=$(curl -s -X POST http://localhost:3001/sse \
  -H "Content-Type: application/json" \
  -d "$INIT_REQUEST" \
  --max-time 2)

echo "Response (first 500 chars):"
echo "$RESPONSE" | head -c 500
echo ""
echo ""

# Test 3: Check if response contains tools capability
echo "3️⃣ Checking for tools capability..."
if echo "$RESPONSE" | grep -q '"tools"'; then
  echo "✅ Server response mentions 'tools'"
else
  echo "❌ No 'tools' found in response"
fi
echo ""

# Test 4: Try to send tools/list request
echo "4️⃣ Testing tools/list..."
TOOLS_REQUEST='{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}'

TOOLS_RESPONSE=$(curl -s -X POST http://localhost:3001/sse \
  -H "Content-Type: application/json" \
  -d "$TOOLS_REQUEST" \
  --max-time 2)

echo "Response (first 1000 chars):"
echo "$TOOLS_RESPONSE" | head -c 1000
echo ""
echo ""

# Check if tools are in the response
echo "5️⃣ Analyzing tools/list response..."
if echo "$TOOLS_RESPONSE" | grep -q 'search_products'; then
  echo "✅ Found 'search_products' tool"
else
  echo "❌ 'search_products' tool NOT found"
fi

if echo "$TOOLS_RESPONSE" | grep -q 'add_to_cart'; then
  echo "✅ Found 'add_to_cart' tool"
else
  echo "❌ 'add_to_cart' tool NOT found"
fi

if echo "$TOOLS_RESPONSE" | grep -q 'inputSchema'; then
  echo "✅ Tools have 'inputSchema'"
else
  echo "❌ No 'inputSchema' found"
fi
echo ""

# Summary
echo "================================================"
echo "📊 Summary"
echo "================================================"
echo ""
echo "If you see ✅ for search_products, add_to_cart, and inputSchema,"
echo "then the server IS returning tools correctly."
echo ""
echo "If ChatGPT still doesn't show actions, the issue is likely:"
echo "1. OAuth2 authentication (ChatGPT can't get a token)"
echo "2. OpenAPI schema format (ChatGPT expecting REST, not SSE)"
echo "3. ChatGPT's MCP client not using tools/list correctly"
echo ""
