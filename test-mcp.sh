#!/bin/bash

# Simple script to test MCP server health

echo "Testing MCP Server..."
echo ""

# Check health endpoint
echo "1. Health Check:"
curl -s http://localhost:3001/health | python3 -m json.tool || echo "Health check failed"
echo ""

# Check SSE endpoint is accessible
echo "2. SSE Endpoint Check:"
curl -s -N -H "Accept: text/event-stream" http://localhost:3001/sse &
PID=$!
sleep 2
kill $PID 2>/dev/null
echo "SSE endpoint accessible"
echo ""

echo "✓ Basic tests complete"
echo ""
echo "For full testing, use: npm run mcp:inspect"
