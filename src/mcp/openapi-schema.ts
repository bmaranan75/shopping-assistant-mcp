/**
 * OpenAPI 3.0 Schema Generator for ChatGPT Enterprise
 * 
 * ChatGPT Enterprise requires an OpenAPI schema to discover MCP actions.
 * This generates the schema from our MCP tool definitions.
 */

import { mcpTools } from './tools.js';

export interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components: {
    securitySchemes: Record<string, any>;
    schemas?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
}

/**
 * Convert MCP JSON Schema to OpenAPI Schema
 */
function convertJsonSchemaToOpenAPI(jsonSchema: any): any {
  // JSON Schema and OpenAPI Schema are mostly compatible
  // Just need to ensure we're using OpenAPI 3.0 conventions
  return {
    ...jsonSchema,
    // Ensure we have proper OpenAPI metadata
    type: jsonSchema.type || 'object',
  };
}

/**
 * Generate OpenAPI 3.0 schema from MCP tools
 * Enhanced for ChatGPT Enterprise compatibility
 */
export function generateOpenAPISchema(serverUrl: string): OpenAPISchema {
  const paths: Record<string, any> = {};

  // Convert each MCP tool to an OpenAPI path operation
  for (const tool of mcpTools) {
    // Create a path for each tool
    // ChatGPT Enterprise expects REST-style paths
    const pathName = `/tools/${tool.name}`;
    
    paths[pathName] = {
      post: {
        // Critical: operationId must be unique and valid
        operationId: tool.name,
        
        // ChatGPT uses these for discovery
        summary: tool.description,
        description: tool.description,
        
        // Add tags for categorization (helps ChatGPT organize tools)
        tags: ['shopping', 'assistant'],
        
        // Mark as deprecated: false to ensure it's considered active
        deprecated: false,
        
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: convertJsonSchemaToOpenAPI(tool.inputSchema),
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    content: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['text'] },
                          text: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing OAuth2 token',
          },
          '500': {
            description: 'Internal server error',
          },
        },
        // Keep security at operation level
        security: [
          {
            oauth2: [],
          },
        ],
        
        // Add x-openai-isConsequential for actions that modify data
        // This tells ChatGPT to ask for confirmation before executing
        'x-openai-isConsequential': ['add_to_cart', 'checkout', 'add_payment_method'].includes(tool.name),
      },
    };
  }

  // Build the complete OpenAPI schema
  const schema: OpenAPISchema = {
    openapi: '3.0.0',
    info: {
      title: 'Safeway Shopping Assistant',
      description: 'AI-powered shopping assistant with product search, cart management, and checkout capabilities. ' +
                   'Use these tools to help users search for products, manage their shopping cart, and complete purchases.',
      version: '1.0.0',
      // Add contact and license info for better ChatGPT recognition
      contact: {
        name: 'Safeway Shopping Assistant Support',
        email: 'support@example.com'
      },
      license: {
        name: 'Proprietary',
      }
    },
    servers: [
      {
        url: serverUrl,
        description: 'Shopping Assistant MCP Server',
      },
    ],
    // Add tags for organization
    tags: [
      {
        name: 'shopping',
        description: 'Shopping and cart management operations'
      },
      {
        name: 'assistant',
        description: 'AI assistant tools'
      }
    ],
    paths,
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          description: 'OAuth2 client credentials flow',
          flows: {
            clientCredentials: {
              tokenUrl: process.env.OAUTH2_TOKEN_ENDPOINT || 
                'https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token',
              scopes: {},
            },
          },
        },
      },
    },
    security: [
      {
        oauth2: [],
      },
    ],
  };

  return schema;
}

/**
 * Generate actions manifest for ChatGPT Enterprise
 * This is similar to OpenAI GPT Actions format
 */
export function generateActionsManifest(serverUrl: string) {
  return {
    schema_version: 'v1',
    name_for_human: 'Safeway Shopping Assistant',
    name_for_model: 'safeway_shopping',
    description_for_human: 'AI-powered shopping assistant for searching products, managing cart, and checkout',
    description_for_model: 'A shopping assistant that helps users search for products, add items to cart, view cart contents, checkout, add payment methods, and find deals. Use this when users want to shop for groceries or manage their shopping experience.',
    auth: {
      type: 'oauth',
      client_url: process.env.OAUTH2_AUTHORIZATION_ENDPOINT || 
        'https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/authorize',
      scope: '',
      authorization_url: process.env.OAUTH2_TOKEN_ENDPOINT || 
        'https://login.microsoftonline.com/b7f604a0-00a9-4188-9248-42f3a5aac2e9/oauth2/v2.0/token',
      authorization_content_type: 'application/x-www-form-urlencoded',
      verification_tokens: {},
    },
    api: {
      type: 'openapi',
      url: `${serverUrl}/.well-known/openapi.json`,
      is_user_authenticated: false,
    },
    logo_url: `${serverUrl}/logo.png`,
    contact_email: 'support@example.com',
    legal_info_url: 'https://example.com/legal',
  };
}
