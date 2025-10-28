# Shopping Assistant - MCP Server

Model Context Protocol (MCP) server for the Shopping Assistant application. This server exposes AI agent capabilities to MCP clients like Claude Desktop.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI applications to seamlessly integrate with various data sources and tools. This MCP server exposes shopping assistant agents as tools that can be called from Claude Desktop or any other MCP-compatible client.

## Features

- **Catalog Agent**: Search and browse product catalog
- **Cart Agent**: Manage shopping cart operations
- **Deals Agent**: Find deals and promotions
- **Payment Agent**: Handle payment operations

## Architecture

```
┌─────────────────────┐
│   Claude Desktop    │
│   (MCP Client)      │
└──────────┬──────────┘
           │ MCP Protocol (SSE)
           ↓
┌─────────────────────┐
│   MCP Server        │
│   Port: 3001        │
└──────────┬──────────┘
           │ HTTP (SDK)
           ↓
┌─────────────────────┐
│   LangGraph Agents  │
│   Port: 2024        │
└─────────────────────┘
```

## Prerequisites

- Node.js 20+
- LangGraph agents server running (see shopping-assistant-agents repo)

## Installation

```bash
npm install
```

## Configuration

Create `.env` file:

```bash
# MCP Server
MCP_SERVER_PORT=3001

# LangGraph Agents (required)
LANGGRAPH_API_URL=http://localhost:2024

# Authentication (optional)
MCP_API_KEY=your-secure-key

# External APIs (optional)
SAFEWAY_API_KEY=your-api-key
```

## Development

```bash
# Start MCP server
npm run dev

# The server will run on:
# SSE endpoint: http://localhost:3001/sse
# Health check: http://localhost:3001/health
```

## Testing with MCP Inspector

```bash
# Start the inspector
npm run mcp:inspect
```

This opens a web UI where you can test MCP tools interactively.

## Using with Claude Desktop

1. Start the MCP server: `npm run dev`

2. Update Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shopping-assistant": {
      "command": "node",
      "args": [
        "/path/to/shopping-assistant-mcp/dist/mcp/server.js"
      ],
      "env": {
        "LANGGRAPH_API_URL": "http://localhost:2024",
        "MCP_SERVER_PORT": "3001"
      }
    }
  }
}
```

3. Restart Claude Desktop

4. Available tools:
   - `catalog_search` - Search for products
   - `cart_view` - View shopping cart
   - `cart_add` - Add items to cart
   - `deals_search` - Find deals
   - `payment_add` - Add payment method

## Project Structure

```
shopping-assistant-mcp/
├── src/
│   ├── mcp/
│   │   ├── server.ts         # Main MCP server
│   │   ├── tools.ts          # MCP tool definitions
│   │   ├── auth.ts           # Authentication
│   │   └── handlers.ts       # Tool handlers
│   └── lib/                  # Shared utilities
├── package.json
├── tsconfig.json
└── README.md
```

## Production Deployment

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Docker

```bash
# Build
docker build -t shopping-assistant-mcp .

# Run
docker run -p 3001:3001 \
  -e LANGGRAPH_API_URL=http://agents:2024 \
  shopping-assistant-mcp
```

## API Endpoints

### Health Check
```bash
GET /health
```

### SSE Endpoint (MCP Protocol)
```bash
GET /sse
```

This is the main endpoint used by MCP clients to communicate with the server using Server-Sent Events.

## Security

### Authentication

The MCP server supports optional API key authentication:

```bash
# In .env
MCP_API_KEY=your-secure-key
```

Tools can verify the API key before processing requests.

### CORS

CORS is configured to allow connections from:
- Claude Desktop
- Local development (localhost)

## Monitoring

### Logs

The server logs all requests and tool executions:

```bash
[MCP] Server starting...
[MCP] Available tools: catalog_search, cart_view, cart_add...
[MCP] Tool execution: catalog_search
[MCP] Success: Found 12 products
```

### LangSmith Tracing

Enable tracing for debugging:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_PROJECT=shopping-assistant-mcp
```

## Troubleshooting

### Server won't start
- Check if port 3001 is available
- Verify Node.js version (20+)
- Check .env configuration

### Tools not working
- Ensure LangGraph agents server is running (port 2024)
- Verify LANGGRAPH_API_URL in .env
- Check network connectivity

### Claude Desktop can't connect
- Verify server is running: `curl http://localhost:3001/health`
- Check Claude Desktop config path
- Restart Claude Desktop after config changes

## Related Repositories

- **shopping-assistant-agents**: LangGraph agents implementation
- **shopping-assistant-chat**: Next.js web interface

## License

MIT
