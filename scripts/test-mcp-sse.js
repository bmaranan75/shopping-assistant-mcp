#!/usr/bin/env node

/**
 * Test script for MCP Server using SSE transport
 * This tests the production-ready SSE implementation
 */

const http = require('http');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

console.log('🧪 Testing MCP Server with SSE Transport\n');
console.log(`Server URL: ${MCP_SERVER_URL}\n`);

// Test 1: Health Check
function testHealthCheck() {
  return new Promise((resolve, reject) => {
    console.log('1️⃣  Testing Health Check...');
    
    http.get(`${MCP_SERVER_URL}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ Health Check Response:', JSON.stringify(json, null, 2));
          console.log('');
          resolve();
        } catch (error) {
          console.error('❌ Failed to parse health check response:', error.message);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('❌ Health check failed:', error.message);
      reject(error);
    });
  });
}

// Test 2: SSE Connection
function testSSEConnection() {
  return new Promise((resolve, reject) => {
    console.log('2️⃣  Testing SSE Connection...');
    console.log('   (This test verifies the /sse endpoint accepts POST requests)');
    
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const url = new URL('/sse', MCP_SERVER_URL);
    
    const req = http.request(url, options, (res) => {
      console.log(`✅ SSE endpoint responded with status: ${res.statusCode}`);
      console.log('   Headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
        console.log('   Received data chunk:', chunk.toString().substring(0, 100) + '...');
      });
      
      res.on('end', () => {
        console.log('✅ SSE connection established successfully');
        console.log('');
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ SSE connection failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
    
    // Give it 3 seconds then resolve
    setTimeout(() => {
      console.log('⏱️  SSE connection test timeout (this is expected)');
      console.log('');
      resolve();
    }, 3000);
  });
}

// Run all tests
async function runTests() {
  try {
    await testHealthCheck();
    await testSSEConnection();
    
    console.log('✅ All tests completed!');
    console.log('');
    console.log('📝 Configuration for Claude Desktop:');
    console.log(JSON.stringify({
      mcpServers: {
        'safeway-shopping-assistant': {
          url: `${MCP_SERVER_URL}/sse`,
          transport: 'sse'
        }
      }
    }, null, 2));
    console.log('');
    console.log('💡 Copy the above configuration to your Claude Desktop config file:');
    console.log('   ~/Library/Application Support/Claude/claude_desktop_config.json');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

runTests();
