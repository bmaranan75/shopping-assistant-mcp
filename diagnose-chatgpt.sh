#!/bin/bash
# Diagnostic script for ChatGPT Enterprise integration

echo "🔍 ChatGPT Enterprise Integration Diagnostics"
echo "=============================================="
echo ""

# Check 1: Is server running?
echo "1️⃣  Server Status"
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ Server is running on localhost:3001"
else
    echo "   ❌ Server is NOT running"
    echo "   Run: npm run dev"
    exit 1
fi
echo ""

# Check 2: OpenAPI schema accessible
echo "2️⃣  OpenAPI Schema"
if curl -sf http://localhost:3001/.well-known/openapi.json > /dev/null 2>&1; then
    echo "   ✅ OpenAPI schema is accessible"
    
    # Check server URL in schema
    server_url=$(curl -s http://localhost:3001/.well-known/openapi.json | python3 -c "import sys, json; print(json.load(sys.stdin)['servers'][0]['url'])" 2>/dev/null)
    echo "   📍 Server URL in schema: $server_url"
    
    if [[ "$server_url" == *"0.0.0.0"* ]] || [[ "$server_url" == *"localhost"* ]]; then
        echo "   ⚠️  WARNING: Server URL is localhost/0.0.0.0"
        echo "   ⚠️  ChatGPT Enterprise CANNOT reach this URL!"
        echo ""
        echo "   💡 Solutions:"
        echo "      Option 1: Deploy to a cloud server with public IP"
        echo "      Option 2: Use ngrok tunnel:"
        echo "         brew install ngrok"
        echo "         ngrok http 3001"
        echo "         Then use: https://YOUR-ID.ngrok.io/.well-known/openapi.json"
        echo ""
    else
        echo "   ✅ Server URL looks publicly accessible"
    fi
    
    # Count tools
    tool_count=$(curl -s http://localhost:3001/.well-known/openapi.json | python3 -c "import sys, json; print(len(json.load(sys.stdin)['paths']))" 2>/dev/null)
    echo "   📊 Tools in schema: $tool_count"
else
    echo "   ❌ OpenAPI schema is NOT accessible"
    exit 1
fi
echo ""

# Check 3: OAuth2 configuration
echo "3️⃣  OAuth2 Configuration"
if [ -f ".env.local" ]; then
    if grep -q "OAUTH2_JWKS_URI" .env.local; then
        jwks_uri=$(grep "OAUTH2_JWKS_URI" .env.local | cut -d'=' -f2)
        echo "   ✅ OAUTH2_JWKS_URI configured"
        echo "   📍 JWKS URI: $jwks_uri"
    else
        echo "   ⚠️  OAUTH2_JWKS_URI not found in .env.local"
    fi
    
    if grep -q "OAUTH2_ISSUER" .env.local; then
        issuer=$(grep "OAUTH2_ISSUER" .env.local | cut -d'=' -f2)
        echo "   ✅ OAUTH2_ISSUER configured"
        echo "   📍 Issuer: $issuer"
    else
        echo "   ⚠️  OAUTH2_ISSUER not found in .env.local"
    fi
else
    echo "   ⚠️  .env.local file not found"
fi
echo ""

# Check 4: Token endpoint in schema
echo "4️⃣  Token Endpoint in OpenAPI Schema"
token_url=$(curl -s http://localhost:3001/.well-known/openapi.json | python3 -c "import sys, json; print(json.load(sys.stdin)['components']['securitySchemes']['oauth2']['flows']['clientCredentials']['tokenUrl'])" 2>/dev/null)
echo "   📍 Token URL: $token_url"
echo ""

# Check 5: Test if token endpoint is reachable
echo "5️⃣  Testing Token Endpoint Accessibility"
if curl -sf "$token_url" > /dev/null 2>&1; then
    echo "   ✅ Token endpoint is reachable"
else
    echo "   ⚠️  Token endpoint test (this might be normal if it requires POST)"
fi
echo ""

echo "=============================================="
echo "📋 Summary for ChatGPT Enterprise Setup"
echo "=============================================="
echo ""
echo "✅ Things to check in ChatGPT Enterprise:"
echo ""
echo "1. URL Configuration:"
echo "   - If your server is on LOCALHOST, ChatGPT Enterprise CANNOT reach it"
echo "   - You MUST use a publicly accessible URL"
echo "   - Options: cloud deployment, ngrok, Cloudflare Tunnel"
echo ""
echo "2. Import Method:"
echo "   - Use 'Import from URL' or 'Import OpenAPI Schema'"
echo "   - NOT 'Connect to MCP server'"
echo ""
echo "3. Authentication:"
echo "   - Type: OAuth 2.0"
echo "   - Flow: Client Credentials"
echo "   - Token URL: $token_url"
echo "   - Get Client ID and Secret from Azure AD"
echo ""
echo "4. After import, ChatGPT should show:"
echo "   - ✅ 6 actions imported"
echo "   - ✅ List of operations: search_products, add_to_cart, etc."
echo ""
echo "❌ If you see '0 actions' or 'No tools found':"
echo "   - Check that ChatGPT can REACH your server URL"
echo "   - Verify the OpenAPI schema URL is correct"
echo "   - Make sure you're using 'Import OpenAPI', not 'Connect MCP'"
echo ""
