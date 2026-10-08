# Urumi AI — Team MCP Gateway

> **Production-grade WooCommerce hosting platform with an audited Team MCP Gateway running on Kubernetes.**

[![Tests](https://img.shields.io/badge/Tests-13%20Passed-emerald.svg)](tests/)
[![Protocol](https://img.shields.io/badge/MCP-Streamable%20HTTP-sky.svg)](docs/mcp-protocol.md)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm%20v3-indigo.svg)](infrastructure/helm/urumi/)
[![Architecture](https://img.shields.io/badge/Architecture-4--Layer-purple.svg)](docs/architecture.md)

---

## 1. Architecture Overview

Urumi AI aggregates e-commerce microservices behind a centralized **Team Model Context Protocol (MCP) Gateway**. 

```mermaid
graph TD
    subgraph Clients
        Dashboard["React Dashboard (:8080)"]
        Store["Storefront Customer (:80)"]
        Claude["Claude Code / Cursor / MCP Inspector"]
    end

    subgraph Kubernetes Ingress
        Ingress["Ingress Controller"]
    end

    subgraph Core Gateway
        Gateway["Urumi MCP Gateway (:8000)"]
        PG[(PostgreSQL Database)]
    end

    subgraph Upstream MCP Servers [Isolated Pods]
        WooMCP["WooCommerce MCP (:8001)"]
        InvMCP["Inventory MCP (:8002)"]
        AnaMCP["Analytics MCP (:8003)"]
    end

    subgraph WooCommerce Store
        WP["WordPress / WooCommerce"]
        MySQL[(MySQL Database)]
    end

    Dashboard --> Ingress
    Store --> Ingress
    Claude --> Ingress
    Ingress --> Gateway
    Ingress --> WP
    Gateway --> PG
    Gateway --> WooMCP
    Gateway --> InvMCP
    Gateway --> AnaMCP
    WooMCP --> WP
    WP --> MySQL
```

### The Cardinal Rule
**The browser and external MCP clients MUST NEVER communicate directly with upstream MCP servers.**  
All tool queries, credentials, authorization checks, and audit trails pass strictly through the Gateway.

---

## 2. Directory Structure

```
urumimcp/
├── README.md
├── .env.example
├── .gitignore
├── Makefile
│
├── apps/
│   ├── dashboard/                  # React 18, Vite, TypeScript, Tailwind CSS
│   └── gateway/                    # FastAPI, Pydantic, SQLAlchemy, MCP Router
│
├── services/
│   ├── woo-mcp/                    # Custom WooCommerce Streamable HTTP MCP Server
│   ├── inventory-mcp/              # Warehouse Inventory Streamable HTTP MCP Server
│   └── analytics-mcp/              # Sales Analytics Streamable HTTP MCP Server
│
├── infrastructure/
│   ├── helm/
│   │   └── urumi/                  # Single Umbrella Helm Chart
│   │       ├── Chart.yaml
│   │       ├── values.yaml         # Base defaults
│   │       ├── values-local.yaml   # Kind / Minikube overrides
│   │       ├── values-prod.yaml    # Production k3s overrides
│   │       └── templates/          # Deployments, StatefulSets, NetworkPolicies
│   └── scripts/                    # Seeding and deployment scripts
│
├── docs/
│   ├── architecture.md             # System topology and layer breakdown
│   ├── system-design.md            # Namespacing, collisions, failure isolation
│   ├── threat-model.md             # SSRF prevention and NetworkPolicies
│   ├── mcp-protocol.md             # Streamable HTTP / JSON-RPC 2.0 specs
│   ├── deployment.md               # Helm, local Kind, and k3s production guide
│   ├── demo-script.md              # 8-12 minute live presentation guide
│   ├── interview-notes.md          # Technical interview preparation guide
│   └── final-verification.md       # Evidence matrix for Definition of Done
│
└── tests/
    ├── unit/                       # Security, SSRF, tool routing, collision tests
    ├── integration/                # Upstream MCPs and Gateway integration
    └── e2e/                        # 14-step full lifecycle verification
```

---

## 3. Quickstart & Local Setup

### Prerequisites
- Python 3.12+
- Node.js 20+ & npm 10+
- Docker & Kubernetes (Kind, Minikube, or k3s)
- Helm v3.12+

### 1. Clone & Configure
```bash
cp .env.example .env
```

### 2. Run All Tests
```bash
python -m pytest tests -v
```
*Executes all 13 unit, integration, and E2E test suites.*

### 3. Build React Dashboard
```bash
cd apps/dashboard
npm install
npm run build
```

---

## 4. Kubernetes Deployment with Helm

Deploying to Kubernetes uses the unified umbrella chart in `infrastructure/helm/urumi/`.

### Local Cluster (Kind / Minikube)
```bash
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace urumi \
  --create-namespace \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-local.yaml
```

### Production k3s Cluster
```bash
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace urumi-prod \
  --create-namespace \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-prod.yaml \
  --wait \
  --timeout 10m
```

### Zero-Downtime Upgrades & Rollbacks
```bash
# Upgrade
helm upgrade urumi ./infrastructure/helm/urumi --set gateway.image.tag="v1.0.1"

# Rollback
helm rollback urumi 1
```

---

## 5. Endpoints & UI Access

| Service | Local Ingress / Port | Description |
| :--- | :--- | :--- |
| **React Dashboard** | `http://localhost:8080` (or `http://localhost:5173`) | Web UI for server config, tools, team, keys, audit, and chat. |
| **Gateway REST API** | `http://localhost:8000/api` | Authentication, server management, and audit logs. |
| **Gateway MCP Endpoint** | `http://localhost:8000/mcp` | Streamable HTTP MCP endpoint for Claude Code, Cursor, and MCP Inspector. |
| **Storefront** | `http://localhost:80` (or `http://localhost:8081`) | WordPress WooCommerce catalog with Cash on Delivery (COD). |

---

## 6. External MCP Client Integration

External MCP clients need **ONLY** two parameters:
1. **Gateway URL**: `http://localhost:8000/mcp`
2. **User API Key**: `umcp_<random_secure_key>`

### A. Claude Code / Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "urumi-gateway": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer umcp_YOUR_COPIED_KEY"
      }
    }
  }
}
```

### B. Cursor Settings
- Add SSE / Streamable HTTP Server
- URL: `http://localhost:8000/mcp`
- Headers: `Authorization: Bearer umcp_YOUR_COPIED_KEY`

### C. MCP Inspector
```bash
npx @modelcontextprotocol/inspector http://localhost:8000/mcp --header "Authorization: Bearer umcp_YOUR_COPIED_KEY"
```

---

## 7. Multi-Server Operational AI Query (Flow D)

Try this query in the AI Chat tab:
> *"Which products sold today are low in inventory?"*

**Behind the Scenes:**
1. Chat agent queries `woo__list_orders` through Gateway.
2. Chat agent queries `inventory__list_inventory` through Gateway.
3. Correlates Order #5001 products against warehouse stock levels.
4. Identifies **Wireless Ultra Mouse** (`MS-WRLS-02`): sold today, remaining stock = 8 (below threshold 15) at `Aisle-2-Shelf-A`.
5. Recommends stock reorder action.
6. Gateway records full audit trail for both tool invocations.

---

## 8. Definition of Done Status

All 8 mandatory flows have been built, verified, and documented:

- [x] **FLOW A — STORE**: Browse products, add to cart, checkout with Cash on Delivery, order verified in WooCommerce.
- [x] **FLOW B — CHAT USER A**: User A creates product via AI Chat; product appears in storefront catalog.
- [x] **FLOW C — EXTERNAL USER B**: User B generates API key; external client connects to Gateway and queries orders.
- [x] **FLOW D — MULTI SERVER**: Single prompt leverages WooCommerce MCP + Inventory MCP tools simultaneously.
- [x] **FLOW E — REVOCATION**: Revoking User B's key causes immediate rejection (401/403).
- [x] **FLOW F — DISABLE SERVER**: Disabling an upstream server instantly purges its tools from the Gateway catalog.
- [x] **FLOW G — POD FAILURE**: Killing WooCommerce MCP pod does not crash Gateway; other upstreams continue working.
- [x] **FLOW H — AUDIT**: Every single tool invocation is logged with operator, duration, outcome, and sanitized payloads.

---

## 9. Comprehensive Documentation Index

- [Architecture Specification](docs/architecture.md)
- [System Design & Resiliency](docs/system-design.md)
- [Threat Model & SSRF Protection](docs/threat-model.md)
- [MCP Streamable Protocol Guide](docs/mcp-protocol.md)
- [Kubernetes & Helm Deployment Guide](docs/deployment.md)
- [8–12 Minute Live Demo Script](docs/demo-script.md)
- [Technical Interview Notes](docs/interview-notes.md)
- [Final Verification Matrix & Test Evidence](docs/final-verification.md)
