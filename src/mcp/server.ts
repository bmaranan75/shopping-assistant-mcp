#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';

import { MCPAgentClient } from './client.js';
import { mcpTools } from './tools.js';
import { verifyAuth, sendAuthError } from './auth-verifier.js';
import { getOpenIDConfiguration } from './openid-discovery.js';
import { generateOpenAPISchema, generateActionsManifest } from './openapi-schema.js';

/**
 * MCP Server that exposes LangGraph agents via SSE (Server-Sent Events)
 * Production-ready implementation using HTTP/SSE transport
 * 
 * Architecture:
 * MCP Client (Claude Desktop/ChatGPT/Cursor) -> MCP Server (this file) -> Next.js API -> LangGraph Agents
 * 
 * Transport: SSE over HTTP (production-ready, works locally and in Kubernetes)
 * 
 * MCP Protocol Version: 2025-06-18 (current)
 */

// Configuration from environment
const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000';
const MCP_SERVER_PORT = parseInt(process.env.MCP_SERVER_PORT || '3001', 10);
const MCP_SERVER_HOST = process.env.MCP_SERVER_HOST || '0.0.0.0'; // Accept connections from any IP
const MCP_AUTH_MODE = process.env.MCP_AUTH_MODE || 'oauth2'; // 'api-key', 'oauth2', 'hybrid', 'none'
const MCP_PROTOCOL_VERSION = '2025-06-18'; // Current MCP protocol version

// Validate OAuth2 configuration if using OAuth2 mode
if (MCP_AUTH_MODE === 'oauth2' || MCP_AUTH_MODE === 'hybrid') {
  const requiredVars = ['OAUTH2_JWKS_URI'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error(`ERROR: OAuth2 authentication requires the following environment variables:`);
    missingVars.forEach(v => console.error(`  - ${v}`));
    console.error(`\nOptional but recommended:`);
    console.error(`  - OAUTH2_ISSUER (token issuer to verify)`);
    console.error(`  - OAUTH2_AUDIENCE (token audience to verify)`);
    console.error(`\nPlease configure these in your .env.local file`);
    console.error(`Or set MCP_AUTH_MODE=none to disable authentication (not recommended for production)`);
    process.exit(1);
  }
}

// Validate API key if using API key mode
if (MCP_AUTH_MODE === 'api-key' || MCP_AUTH_MODE === 'hybrid') {
  if (!process.env.MCP_API_KEY) {
    console.error('ERROR: MCP_API_KEY environment variable is required when using API key authentication');
    console.error('Please set MCP_API_KEY in your .env.local file');
    console.error(`Or set MCP_AUTH_MODE=oauth2 to use OAuth2 authentication only`);
    process.exit(1);
  }
}

// Initialize HTTP client (no authentication needed here, it will be passed per request)
const agentClient = new MCPAgentClient(NEXTJS_URL);

// Track MCP protocol method calls for debugging
let initializeCalled = false;
let toolsListCalled = false;
let toolsListCallCount = 0;

// Create MCP server with proper protocol version and capabilities
const server = new Server(
  {
    name: 'safeway-shopping-assistant',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {
        // Explicitly declare we support tools/list and tools/call
        // No listChanged support for now to keep it simple
      },
    },
  }
);

console.error('[MCP Server] Server created with capabilities:', {
  tools: true,
  protocolVersion: MCP_PROTOCOL_VERSION,
});

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const startTime = Date.now();
  toolsListCalled = true;
  toolsListCallCount++;
  
  console.error('[MCP Server] ========================================');
  console.error('[MCP Server] ✅ tools/list CALLED');
  console.error(`[MCP Server] Call count: ${toolsListCallCount}`);
  console.error(`[MCP Server] Timestamp: ${new Date().toISOString()}`);
  console.error('[MCP Server] ========================================');
  
  // Ensure we return tools in the correct format
  const toolsList = mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  
  console.error(`[MCP Server] Returning ${toolsList.length} tools:`);
  toolsList.forEach((tool, i) => {
    console.error(`  ${i + 1}. ${tool.name} - ${tool.description}`);
  });
  console.error(`[MCP Server] Response format check:`);
  console.error(`  - Type: ${typeof toolsList}`);
  console.error(`  - Is Array: ${Array.isArray(toolsList)}`);
  console.error(`  - Length: ${toolsList.length}`);
  console.error(`[MCP Server] tools/list completed in ${Date.now() - startTime}ms`);
  console.error('[MCP Server] ========================================');
  
  return { 
    tools: toolsList,
    // Optional: include nextCursor if implementing pagination (not needed for <50 tools)
  };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  console.error(`[MCP Server] Tool called: ${name}`, JSON.stringify(args, null, 2));

  try {
    let result;

    // Route tool calls to appropriate agents via HTTP
    switch (name) {
      case 'search_products':
        result = await agentClient.callAgent('catalog', {
          action: 'search',
          query: args.query,
          category: args.category,
          limit: args.limit,
        });
        break;

      case 'add_to_cart':
        result = await agentClient.callAgent('cart', {
          action: 'add',
          productCode: args.productCode,
          quantity: args.quantity,
        });
        break;

      case 'view_cart':
        result = await agentClient.callAgent('cart', {
          action: 'view',
        });
        break;

      case 'checkout':
        result = await agentClient.callAgent('cart', {
          action: 'checkout',
          cartSummary: args.cartSummary,
        });
        break;

      case 'add_payment_method':
        result = await agentClient.callAgent('payment', {
          action: 'add',
          type: args.type,
        });
        break;

      case 'get_deals':
        result = await agentClient.callAgent('deals', {
          action: 'get',
          category: args.category,
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    console.error(`[MCP Server] Tool ${name} completed successfully`);

    // Extract the final AI message content from the result
    let responseText = '';
    if (result && result.messages && Array.isArray(result.messages)) {
      // Get the last AI message
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage && lastMessage.kwargs && lastMessage.kwargs.content) {
        responseText = lastMessage.kwargs.content;
      } else {
        // Fallback to full result
        responseText = JSON.stringify(result, null, 2);
      }
    } else {
      responseText = JSON.stringify(result, null, 2);
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error: any) {
    console.error(`[MCP Server] Tool ${name} failed:`, error);

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start MCP server with SSE transport
async function main() {
  console.error('[MCP Server] Starting Safeway Shopping Assistant MCP Server...');
  console.error(`[MCP Server] Transport: SSE (Server-Sent Events)`);
  console.error(`[MCP Server] Server URL: http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}`);
  console.error(`[MCP Server] Next.js API URL: ${NEXTJS_URL}`);
  console.error(`[MCP Server] Authentication Mode: ${MCP_AUTH_MODE}`);
  
  if (MCP_AUTH_MODE === 'oauth2' || MCP_AUTH_MODE === 'hybrid') {
    console.error(`[MCP Server] OAuth2 JWKS URI: ${process.env.OAUTH2_JWKS_URI}`);
    if (process.env.OAUTH2_ISSUER) {
      console.error(`[MCP Server] OAuth2 Issuer: ${process.env.OAUTH2_ISSUER}`);
    }
    if (process.env.OAUTH2_AUDIENCE) {
      console.error(`[MCP Server] OAuth2 Audience: ${process.env.OAUTH2_AUDIENCE}`);
    }
  }
  
  // Periodic status check to monitor if ChatGPT is calling tools/list
  setInterval(() => {
    console.error('[MCP Server] ========================================');
    console.error('[MCP Server] Protocol Call Status:');
    console.error(`  - tools/list called: ${toolsListCalled ? `YES ✅ (${toolsListCallCount} times)` : 'NO ❌'}`);
    console.error(`  - Last check: ${new Date().toISOString()}`);
    if (!toolsListCalled) {
      console.error('  ⚠️  WARNING: tools/list has never been called!');
      console.error('  ⚠️  This means ChatGPT is not discovering tools.');
      console.error('  ⚠️  Possible causes:');
      console.error('     1. Authentication failure (check OAuth2 config)');
      console.error('     2. ChatGPT not completing MCP handshake');
      console.error('     3. ChatGPT configured for OpenAPI not MCP');
    }
    console.error('[MCP Server] ========================================');
  }, 30000); // Every 30 seconds

  // Create HTTP server for SSE transport
  const httpServer = http.createServer(async (req, res) => {
    // CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'safeway-shopping-assistant-mcp',
        version: '1.0.0',
        transport: 'sse',
        tools: mcpTools.map(t => t.name),
      }));
      return;
    }

    // MCP OAuth Protected Resource metadata endpoint
    if ((req.url === '/.well-known/oauth-protected-resource' ||
         req.url === '/sse/.well-known/oauth-protected-resource') &&
        req.method === 'GET') {
      console.error('[MCP Server] OAuth Protected Resource metadata request');
      
      // If authentication is disabled, return 404
      if (MCP_AUTH_MODE === 'none') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'not_found',
          error_description: 'OAuth not enabled'
        }));
        return;
      }
      
      const issuer = process.env.OAUTH2_ISSUER || 'https://sts.windows.net/b7f604a0-00a9-4188-9248-42f3a5aac2e9/';
      const audience = process.env.OAUTH2_AUDIENCE || '00000002-0000-0000-c000-000000000000';
      const tokenEndpoint = process.env.OAUTH2_TOKEN_ENDPOINT || 
        `https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/token`;
      
      // Return MCP OAuth metadata - explicitly for client credentials only
      const metadata = {
        resource: audience,
        authorization_servers: [issuer],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://github.com/bmaranan75/shopping-assistant-mcp',
        grant_types_supported: ['client_credentials'],
        token_endpoint: tokenEndpoint,
      };
      
      console.error('[MCP Server] OAuth Protected Resource metadata:', metadata);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metadata, null, 2));
      return;
    }

    // OpenID Connect Discovery endpoint (support both root and /sse subpath)
    if ((req.url === '/.well-known/openid-configuration' || 
         req.url === '/sse/.well-known/openid-configuration') && 
        req.method === 'GET') {
      console.error('[MCP Server] OpenID Discovery request');
      
      // If authentication is disabled, don't advertise OAuth2 capabilities
      if (MCP_AUTH_MODE === 'none') {
        console.error('[MCP Server] Authentication disabled - returning 404 for OpenID discovery');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'not_found',
          error_description: 'OpenID Connect Discovery not available when authentication is disabled'
        }));
        return;
      }
      
      try {
        const config = await getOpenIDConfiguration();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(config, null, 2));
      } catch (error: any) {
        console.error('[MCP Server] Failed to get OpenID config:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'internal_server_error',
          error_description: 'Failed to retrieve OpenID configuration'
        }));
      }
      return;
    }

    // OpenAPI Schema endpoint for ChatGPT Enterprise
    if ((req.url === '/.well-known/openapi.json' || req.url === '/openapi.json') && 
        req.method === 'GET') {
      console.error('[MCP Server] OpenAPI schema request');
      
      const serverUrl = `http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}`;
      const schema = generateOpenAPISchema(serverUrl);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(schema, null, 2));
      return;
    }

    // Actions manifest endpoint for ChatGPT Enterprise
    if ((req.url === '/.well-known/ai-plugin.json' || req.url === '/ai-plugin.json') && 
        req.method === 'GET') {
      console.error('[MCP Server] Actions manifest request');
      
      const serverUrl = `http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}`;
      const manifest = generateActionsManifest(serverUrl);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest, null, 2));
      return;
    }

    // MCP SSE endpoint
    if (req.url === '/sse' && req.method === 'POST') {
      console.error('[MCP Server] New SSE connection attempt');

      // Verify authentication
      const authResult = await verifyAuth(req);
      
      if (!authResult.success) {
        console.error('[MCP Server] Authentication failed:', authResult.error);
        sendAuthError(res, authResult.error || 'Authentication required');
        return;
      }

      console.error('[MCP Server] Authentication successful');
      
      // Store auth tokens for this connection
      if (authResult.accessToken) {
        agentClient.setAccessToken(authResult.accessToken);
      }
      
      if (authResult.userToken) {
        agentClient.setUserToken(authResult.userToken);
      }

      console.error('[MCP Server] SSE connection established');

      const transport = new SSEServerTransport('/message', res);
      await server.connect(transport);

      // Handle connection close
      req.on('close', () => {
        console.error('[MCP Server] SSE connection closed');
      });

      return;
    }

    // REST-style tool execution endpoints for ChatGPT Enterprise
    // These match the paths defined in the OpenAPI schema
    if (req.url?.startsWith('/tools/') && req.method === 'POST') {
      console.error('[MCP Server] REST tool execution request:', req.url);

      // Verify authentication
      const authResult = await verifyAuth(req);
      
      if (!authResult.success) {
        console.error('[MCP Server] Authentication failed:', authResult.error);
        sendAuthError(res, authResult.error || 'Authentication required');
        return;
      }

      // Extract tool name from URL
      const toolName = req.url.substring('/tools/'.length);
      
      // Parse request body
      let requestBody = '';
      req.on('data', (chunk) => {
        requestBody += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const args = JSON.parse(requestBody);
          console.error(`[MCP Server] Executing tool: ${toolName}`, args);

          // Store auth tokens for this request
          if (authResult.accessToken) {
            agentClient.setAccessToken(authResult.accessToken);
          }
          
          if (authResult.userToken) {
            agentClient.setUserToken(authResult.userToken);
          }

          // Execute the tool (reuse the same logic from the MCP handler)
          let result;
          switch (toolName) {
            case 'search_products':
              result = await agentClient.callAgent('catalog', {
                action: 'search',
                query: args.query,
                category: args.category,
                limit: args.limit,
              });
              break;

            case 'add_to_cart':
              result = await agentClient.callAgent('cart', {
                action: 'add',
                productCode: args.productCode,
                quantity: args.quantity,
              });
              break;

            case 'view_cart':
              result = await agentClient.callAgent('cart', {
                action: 'view',
              });
              break;

            case 'checkout':
              result = await agentClient.callAgent('cart', {
                action: 'checkout',
                cartSummary: args.cartSummary,
              });
              break;

            case 'add_payment_method':
              result = await agentClient.callAgent('payment', {
                action: 'add',
                type: args.type,
              });
              break;

            case 'get_deals':
              result = await agentClient.callAgent('deals', {
                action: 'get',
                category: args.category,
              });
              break;

            default:
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unknown tool: ' + toolName }));
              return;
          }

          // Format response in MCP format
          let responseText = '';
          if (result && result.messages && Array.isArray(result.messages)) {
            const lastMessage = result.messages[result.messages.length - 1];
            if (lastMessage && lastMessage.kwargs && lastMessage.kwargs.content) {
              responseText = lastMessage.kwargs.content;
            } else {
              responseText = JSON.stringify(result, null, 2);
            }
          } else {
            responseText = JSON.stringify(result, null, 2);
          }

          const response = {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          };

          console.error(`[MCP Server] Tool ${toolName} completed successfully`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response, null, 2));

        } catch (error: any) {
          console.error(`[MCP Server] Tool execution failed:`, error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Internal server error',
            message: error.message,
          }));
        }
      });

      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  // Start listening
  httpServer.listen(MCP_SERVER_PORT, MCP_SERVER_HOST, () => {
    console.error(`[MCP Server] Listening on http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}`);
    console.error('[MCP Server] SSE endpoint: POST http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}/sse');
    console.error('[MCP Server] Health check: GET http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}/health');
    console.error('[MCP Server] Ready to receive MCP requests from clients');
    console.error('[MCP Server] Available tools:', mcpTools.map(t => t.name).join(', '));
    console.error('');
    console.error('[MCP Server] Configuration for clients:');
    console.error(JSON.stringify({
      mcpServers: {
        'safeway-shopping-assistant': {
          url: `http://localhost:${MCP_SERVER_PORT}/sse`,
          transport: 'sse'
        }
      }
    }, null, 2));
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.error('\n[MCP Server] Shutting down gracefully...');
    httpServer.close(() => {
      console.error('[MCP Server] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.error('\n[MCP Server] Received SIGTERM, shutting down gracefully...');
    httpServer.close(() => {
      console.error('[MCP Server] Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
