import { NextRequest } from 'next/server';
import { verifyDualTokenAuth, AuthContext } from './dual-token-auth';

/**
 * MCP Authentication - Supports two modes:
 * 
 * 1. Legacy Mode (API Key) - For backward compatibility
 *    Header: X-MCP-API-Key: <api_key>
 * 
 * 2. Enterprise Mode (OAuth2 Dual Token) - Recommended
 *    Header: Authorization: Bearer <client_credentials_token>
 *    Header: X-User-Token: Bearer <user_oauth2_token> (optional)
 * 
 * Mode is auto-detected based on which headers are present.
 */

/**
 * Verify MCP authentication using either API Key (legacy) or OAuth2 tokens (enterprise)
 * 
 * @param req - HTTP request
 * @returns AuthContext if OAuth2, null if API key (legacy)
 * @throws MCPAuthError if authentication fails
 */
export async function verifyMCPAuth(req: NextRequest): Promise<AuthContext | null> {
  const authMode = process.env.MCP_AUTH_MODE || 'hybrid'; // 'api-key', 'oauth2', 'hybrid'
  
  // Check if OAuth2 Authorization header is present
  const hasOAuthHeader = req.headers.get('Authorization')?.startsWith('Bearer ');
  
  // Enterprise Mode: OAuth2 Dual Token
  if (hasOAuthHeader && (authMode === 'oauth2' || authMode === 'hybrid')) {
    try {
      const authContext = await verifyDualTokenAuth(req);
      console.log('[MCP Auth] OAuth2 authentication successful:', {
        clientId: authContext.clientId,
        userId: authContext.userId,
        method: authContext.authMethod,
      });
      return authContext;
    } catch (error: any) {
      console.error('[MCP Auth] OAuth2 authentication failed:', error.message);
      throw new MCPAuthError(`OAuth2 authentication failed: ${error.message}`);
    }
  }
  
  // Legacy Mode: API Key
  if (authMode === 'api-key' || authMode === 'hybrid') {
    const apiKey = req.headers.get('X-MCP-API-Key');
    const expectedKey = process.env.MCP_API_KEY;
    
    if (!expectedKey) {
      throw new MCPAuthError('MCP authentication not configured');
    }
    
    if (apiKey === expectedKey) {
      console.log('[MCP Auth] API Key authentication successful');
      return null; // Legacy mode doesn't have auth context
    }
    
    // If we got here in hybrid mode and no OAuth header, API key was wrong
    if (!hasOAuthHeader) {
      throw new MCPAuthError('Invalid MCP API key');
    }
  }
  
  // No valid authentication method found
  throw new MCPAuthError('No valid authentication provided');
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use verifyMCPAuth() instead
 */
export function verifyMCPAuthLegacy(req: NextRequest): boolean {
  const apiKey = req.headers.get('X-MCP-API-Key');
  const expectedKey = process.env.MCP_API_KEY;
  
  if (!expectedKey) {
    console.warn('MCP_API_KEY not configured');
    return false;
  }
  
  return apiKey === expectedKey;
}

export class MCPAuthError extends Error {
  constructor(message: string = 'Unauthorized MCP request') {
    super(message);
    this.name = 'MCPAuthError';
  }
}