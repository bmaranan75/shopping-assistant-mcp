#!/bin/bash
# Quick test to verify OpenAPI endpoint is accessible

echo "🔍 Testing OpenAPI Schema Endpoint"
echo ""
echo "Testing: http://localhost:3001/.well-known/openapi.json"
echo ""

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/.well-known/openapi.json)

if [ "$response" = "200" ]; then
    echo "✅ OpenAPI endpoint is accessible (HTTP $response)"
    echo ""
    echo "📋 OpenAPI Schema Content:"
    echo ""
    curl -s http://localhost:3001/.well-known/openapi.json | head -50
    echo ""
    echo "..."
    echo ""
    echo "🎯 Tool Paths:"
    curl -s http://localhost:3001/.well-known/openapi.json | grep -A 1 '"paths"' | head -20
    echo ""
    echo "✅ This URL should work in ChatGPT Enterprise!"
    echo ""
    echo "📝 Configure ChatGPT Enterprise with:"
    echo "   Import from URL: http://your-public-host:3001/.well-known/openapi.json"
else
    echo "❌ OpenAPI endpoint returned HTTP $response"
    echo ""
    echo "Make sure:"
    echo "1. MCP server is running (npm run dev)"
    echo "2. Server is listening on port 3001"
fi
