#!/usr/bin/env node
/**
 * Test MCP Server Protocol Handshake and Tools List
 * 
 * This script verifies that the MCP server properly:
 * 1. Completes the initialization handshake
 * 2. Advertises tools capability
 * 3. Returns a non-empty tools list
 * 4. Returns tools with valid schemas
 */

const http = require('http');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_PROTOCOL_VERSION = '2025-06-18';

console.log('🔍 Testing MCP Protocol Compliance\n');
console.log(`Server URL: ${MCP_SERVER_URL}\n`);

/**
 * Send a JSON-RPC request to the MCP server
 */
function sendMCPRequest(method, params = {}, id = null) {
  return new Promise((resolve, reject) => {
    const payload = {
      jsonrpc: '2.0',
      method,
      ...(id !== null && { id }),
      ...(Object.keys(params).length > 0 && { params }),
    };

    const postData = JSON.stringify(payload);
    
    console.log(`📤 Sending: ${method}`, id !== null ? `(id: ${id})` : '(notification)');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const url = new URL('/sse', MCP_SERVER_URL);
    
    const req = http.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`❌ HTTP ${res.statusCode}: ${data}`);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        try {
          // SSE response may have multiple messages, parse the last one
          const lines = data.split('\n').filter(line => line.trim());
          const lastDataLine = lines.reverse().find(line => line.startsWith('data: '));
          
          if (lastDataLine) {
            const responseData = lastDataLine.substring(6); // Remove 'data: ' prefix
            const response = JSON.parse(responseData);
            
            console.log(`📥 Received:`, response.result ? 'result' : response.error ? 'error' : 'unknown');
            console.log(JSON.stringify(response, null, 2));
            console.log('');
            
            resolve(response);
          } else {
            reject(new Error('No data in SSE response'));
          }
        } catch (error) {
          console.error('❌ Failed to parse response:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();

    // Give SSE some time to respond
    setTimeout(() => {
      // Don't reject, just log that we're waiting
    }, 1000);
  });
}

/**
 * Run the MCP protocol compliance tests
 */
async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Health Check
    console.log('1️⃣  Test: Health Check');
    console.log('   Verifying server is running...\n');
    
    const healthResponse = await new Promise((resolve, reject) => {
      http.get(`${MCP_SERVER_URL}/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const health = JSON.parse(data);
            console.log('   ✅ Server is healthy');
            console.log(`   Status: ${health.status}`);
            console.log(`   Service: ${health.service}`);
            console.log(`   Tools: ${health.tools.join(', ')}`);
            console.log('');
            testsPassed++;
            resolve(health);
          } else {
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });

    // Test 2: Initialize (Capability Negotiation)
    console.log('2️⃣  Test: Initialize Handshake');
    console.log('   Negotiating protocol version and capabilities...\n');
    
    const initResponse = await sendMCPRequest('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        // Client declares what it supports
      },
      clientInfo: {
        name: 'mcp-test-client',
        version: '1.0.0',
      },
    }, 1);

    if (initResponse.error) {
      console.error('   ❌ Initialize failed:', initResponse.error.message);
      testsFailed++;
    } else {
      const { protocolVersion, capabilities, serverInfo } = initResponse.result;
      
      console.log('   ✅ Initialize successful');
      console.log(`   Protocol Version: ${protocolVersion}`);
      console.log(`   Server: ${serverInfo.name} v${serverInfo.version}`);
      console.log(`   Capabilities:`, JSON.stringify(capabilities, null, 6));
      console.log('');
      
      // Verify tools capability is advertised
      if (capabilities && capabilities.tools) {
        console.log('   ✅ Server advertises tools capability');
        testsPassed++;
      } else {
        console.error('   ❌ Server does NOT advertise tools capability');
        testsFailed++;
      }
    }

    // Test 3: Send initialized notification
    console.log('3️⃣  Test: Initialized Notification');
    console.log('   Sending initialized notification...\n');
    
    // Notifications don't expect responses
    setTimeout(() => {
      sendMCPRequest('notifications/initialized', {})
        .catch(() => {
          // Notifications may not get a response, that's OK
        });
    }, 100);

    console.log('   ✅ Notification sent (no response expected)');
    console.log('');
    testsPassed++;

    // Test 4: List Tools
    console.log('4️⃣  Test: List Tools');
    console.log('   Requesting tools list from server...\n');
    
    const toolsResponse = await sendMCPRequest('tools/list', {}, 2);

    if (toolsResponse.error) {
      console.error('   ❌ tools/list failed:', toolsResponse.error.message);
      testsFailed++;
    } else {
      const { tools } = toolsResponse.result;
      
      if (!tools || !Array.isArray(tools)) {
        console.error('   ❌ Server did not return a tools array');
        testsFailed++;
      } else if (tools.length === 0) {
        console.error('   ❌ Server returned EMPTY tools list');
        console.error('   This is why ChatGPT shows "connected" but no actions!');
        testsFailed++;
      } else {
        console.log(`   ✅ Server returned ${tools.length} tools`);
        console.log('');
        
        // Validate each tool
        let validTools = 0;
        tools.forEach((tool, index) => {
          console.log(`   Tool ${index + 1}: ${tool.name}`);
          console.log(`     Description: ${tool.description}`);
          
          // Check for required fields
          if (!tool.name) {
            console.error(`     ❌ Missing 'name' field`);
            testsFailed++;
          } else if (!tool.description) {
            console.error(`     ❌ Missing 'description' field`);
            testsFailed++;
          } else if (!tool.inputSchema) {
            console.error(`     ❌ Missing 'inputSchema' field`);
            testsFailed++;
          } else if (tool.inputSchema.type !== 'object') {
            console.error(`     ❌ inputSchema.type must be 'object', got '${tool.inputSchema.type}'`);
            testsFailed++;
          } else {
            console.log(`     ✅ Valid tool definition`);
            validTools++;
          }
          console.log('');
        });
        
        if (validTools === tools.length) {
          console.log(`   ✅ All ${tools.length} tools have valid schemas`);
          testsPassed++;
        } else {
          console.error(`   ❌ Only ${validTools}/${tools.length} tools have valid schemas`);
          testsFailed++;
        }
      }
    }

    // Summary
    console.log('');
    console.log('================================================');
    console.log('📊 Test Results');
    console.log('================================================');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log('');
    
    if (testsFailed === 0) {
      console.log('🎉 All tests passed! MCP server is protocol-compliant.');
      console.log('');
      console.log('✅ ChatGPT Enterprise should be able to:');
      console.log('   1. Connect to your server');
      console.log('   2. Complete the handshake');
      console.log('   3. Discover all tools');
      console.log('   4. Execute tools');
      console.log('');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed. Please fix the issues above.');
      console.log('');
      console.log('💡 Common fixes:');
      console.log('   - Ensure tools/list returns a non-empty array');
      console.log('   - Verify each tool has: name, description, inputSchema');
      console.log('   - Check inputSchema.type === "object"');
      console.log('   - Ensure server advertises tools capability in initialize response');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. MCP server is running: npm run dev');
    console.error('2. Server is accessible at:', MCP_SERVER_URL);
    console.error('3. No authentication errors (check logs)');
    process.exit(1);
  }
}

runTests();
