# Model Context Protocol (MCP) Specification: Streamable HTTP

## 1. Protocol Architecture & Transports

Urumi AI implements the Anthropic Model Context Protocol (MCP) using **Streamable HTTP**.

```
[ External MCP Clients ] ──────────(Streamable HTTP / JSON-RPC 2.0)──────────> [ Urumi Gateway ]
(Claude Code / Cursor / Inspector)                                                    │
                                                                           (Streamable HTTP)
                                                                                      ▼
                                                                           [ Upstream MCP Servers ]
                                                                           (Woo / Inventory / Analytics)
```

### Why Streamable HTTP over stdio?
1. **Kubernetes-Native Scalability**: In Kubernetes, pods communicate over cluster networking (TCP/IP). Stdio requires child process spawning which cannot bridge network boundaries or horizontal pod replicas.
2. **Stateless Load Balancing**: Streamable HTTP requests can be load-balanced across multiple Gateway replicas via Kubernetes Ingress/Services.
3. **Session Resiliency**: Clients can reconnect across network hiccups without terminating the remote container process.

---

## 2. JSON-RPC 2.0 Methods

The Gateway and all upstream servers speak standard JSON-RPC 2.0 over `POST /mcp`.

### Method: `initialize`
Establishes client session, negotiates protocol version, and returns server capabilities.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-code",
      "version": "1.0.0"
    }
  }
}
```

**Gateway Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "urumi-team-mcp-gateway",
      "version": "1.0.0"
    }
  }
}
```

---

### Method: `tools/list`
Returns available tools. The Gateway aggregates tools from all healthy upstream servers and namespaces them with `<server_slug>__<tool_name>`.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list",
  "params": {}
}
```

**Gateway Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "tools": [
      {
        "name": "woo__list_products",
        "description": "[WooCommerce Store] List products from the WooCommerce catalog.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "status": { "type": "string" },
            "per_page": { "type": "integer" }
          }
        }
      },
      {
        "name": "inventory__list_inventory",
        "description": "[Warehouse Inventory] List warehouse inventory items with stock levels.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "low_stock_only": { "type": "boolean" }
          }
        }
      },
      {
        "name": "analytics__get_sales_summary",
        "description": "[Sales Analytics] Get high-level store sales revenue and metrics.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "period": { "type": "string" }
          }
        }
      }
    ]
  }
}
```

---

### Method: `tools/call`
Executes an aggregated tool. Gateway parses the namespace prefix, resolves the upstream server, injects credentials, checks RBAC, records an audit log, and returns the result.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "woo__create_product",
    "arguments": {
      "name": "Demo Mechanical Keyboard",
      "regular_price": "1499.00",
      "stock_quantity": 50
    }
  }
}
```

**Gateway Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "content": [
      {
        "type": "text",
        "structured": {
          "id": 104,
          "name": "Demo Mechanical Keyboard",
          "price": "1499.00",
          "status": "publish",
          "stock_quantity": 50
        }
      }
    ],
    "isError": false
  }
}
```

---

## 3. Client Configuration Guide

### A. Claude Code / Claude Desktop
Add the Gateway to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "urumi-gateway": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer umcp_YOUR_SECURE_API_KEY"
      }
    }
  }
}
```

### B. Cursor
In Cursor Settings ➔ Features ➔ MCP Servers ➔ Add New MCP Server:
- **Type**: `SSE / Streamable HTTP`
- **Name**: `Urumi Gateway`
- **URL**: `http://localhost:8000/mcp`
- **Headers**:
  - `Authorization`: `Bearer umcp_YOUR_SECURE_API_KEY`

### C. MCP Inspector
Run official MCP Inspector:
```bash
npx @modelcontextprotocol/inspector http://localhost:8000/mcp --header "Authorization: Bearer umcp_YOUR_SECURE_API_KEY"
```
