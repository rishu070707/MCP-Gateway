# Live Demo Script (8–12 Minutes): Urumi AI Team MCP Gateway

## Overview & Demo Timing

| Scene | Duration | Focus Area | Actions & Talking Points |
| :--- | :--- | :--- | :--- |
| **1. Architecture** | 0:45 | System Overview | Present 4 layers: Storefront, Upstream MCPs, Gateway, AI Agent. Emphasize: *Browser and external clients never touch upstreams.* |
| **2. Kubernetes** | 0:45 | Cluster Topology | Show `kubectl get pods -n urumi`. Point out Gateway, Dashboard, Woo MCP, Inventory MCP, Analytics MCP, Postgres, MySQL. |
| **3. Storefront** | 0:45 | Catalog & Products | Open Storefront tab. Display seeded products (Ergonomic Keyboard, Ultra Mouse, USB-C Hub) configured with INR currency. |
| **4. WooCommerce Order** | 0:45 | Checkout Flow | Add product to cart. Checkout with Cash on Delivery (COD). Confirm Order #5001 is placed into WordPress. |
| **5. Dashboard** | 0:45 | SaaS Overview | Open React Dashboard (`http://localhost:8080`). Show real-time KPI cards: Connected Servers (3), Total Tools (11), Team (2). |
| **6. MCP Servers** | 0:45 | Server Registry | Navigate to MCP Servers page. Point out `woo`, `inventory`, `analytics`. Highlight status badges (`CONNECTED`) and server-side credentials. |
| **7. Chat Agent** | 0:45 | AI Agent Interface | Navigate to AI Chat Agent. Note the active identity: *Logged in as User A (Admin)*. |
| **8. User A (Admin)** | 0:45 | Product Creation | User A sends: `"Create a product called Demo Keyboard priced at 1499."` Watch Gateway invoke `woo__create_product`, record audit, and confirm product is live in store. |
| **9. User B (Member)** | 0:45 | Team RBAC | Switch to User B (`bob@urumi.local`, Role: `MEMBER`). Demonstrate that member can query tools and chat, but cannot add/delete upstream servers. |
| **10. External MCP Client** | 1:00 | API Key Auth | Generate API Key for User B (`umcp_...`). Copy key. Show one-time reveal. Configure Claude Code / MCP Inspector with Gateway URL + Key. Call `tools/list`. |
| **11. Multi-Server Query**| 1:15 | Cross-Domain Prompt | Prompt: `"Which products sold today are low in inventory?"` Watch agent call `woo__list_orders` AND `inventory__list_inventory`, correlate results, and flag Wireless Ultra Mouse. |
| **12. Revoke API Key** | 0:45 | Revocation Flow | In Dashboard API Keys, click **Revoke** on User B's key. Re-send request from external MCP client. Observe immediate `401 / 403` rejection. |
| **13. Disable Server** | 0:45 | Dynamic Discovery | In MCP Servers, toggle **Disable** on Analytics MCP. Refresh tools: `analytics__...` tools instantly disappear from Gateway. |
| **14. Kill MCP Pod** | 1:00 | Failure Isolation | Run `kubectl delete pod -l app.kubernetes.io/component=woo-mcp`. Watch Gateway stay 100% healthy. Inventory and Analytics tools continue functioning without delay. |
| **15. Audit Logs** | 0:45 | Forensic Audit Trail| Open Audit Logs tab. Inspect recent entries showing timestamp, operator email, duration (ms), sanitized request/response, and outcome. |
| **16. Security & SSRF** | 0:45 | Threat Prevention | Try adding upstream server with URL `http://169.254.169.254`. Show Gateway SSRF filter immediately rejecting cloud metadata probe. |
| **17. Helm Architecture** | 0:45 | Umbrella Chart | Walk through `infrastructure/helm/urumi/`. Show unified chart, values structure, non-root security contexts, NetworkPolicies. |
| **18. Local ➔ k3s** | 0:30 | Production Rollout | Show `values-local.yaml` vs `values-prod.yaml`. Highlight seamless transition from local developer cluster to production k3s. |

---

## Step-by-Step Presenter Transcript

### Scene 1: Architecture
> *"Good morning. Today we are demonstrating Urumi AI — an enterprise WooCommerce hosting platform with an audited Team MCP Gateway running on Kubernetes.
> In our architecture, the browser and external MCP clients NEVER communicate directly with upstream MCP servers. The Gateway serves as the single secure reverse proxy, credential vault, tool aggregator, and audit logger."*

### Scene 2: Kubernetes
> *"Let's look at the cluster state. In namespace `urumi`, we have our React Dashboard, Gateway backend, three distinct Streamable HTTP MCP servers—WooCommerce, Inventory, and Analytics—plus PostgreSQL and MySQL StatefulSets."*

### Scene 3 & 4: Storefront & Order
> *"Our store is populated with catalog items and supports test-friendly Cash on Delivery checkout. Let's purchase an Ergonomic Keyboard and place Order #5001. That order is now recorded in WooCommerce."*

### Scene 5 & 6: Dashboard & Servers
> *"Switching to our React SaaS dashboard, we can see all three upstream servers marked `CONNECTED`. Tools are namespaced as `woo__`, `inventory__`, and `analytics__` to prevent naming collisions."*

### Scene 7 & 8: Chat Agent & User A
> *"Now let's ask the AI agent: 'Create a product called Demo Keyboard priced at 1499.'
> The agent routes the call through the Gateway to `woo__create_product`. The product is created and immediately appears in the WooCommerce catalog."*

### Scene 9 & 10: User B & External MCP Client
> *"Next, we log in as User B—a regular team member. User B generates an API key: `umcp_...`. Notice the key is revealed once. When an external client like Claude Code connects using only the Gateway URL and this key, it discovers all enabled tools without ever seeing our upstream WordPress credentials."*

### Scene 11: Multi-Server Query
> *"Here is the key multi-server capability. We ask:
> 'Which products sold today are low in inventory?'
> The agent invokes `woo__list_orders` to see today's sales, and `inventory__list_inventory` to check stock levels. It cross-references both data streams and warns us that the Wireless Ultra Mouse sold today has only 8 units left in the warehouse."*

### Scene 12: Revocation
> *"Let's revoke User B's API key in one click. When the external client tries to make another tool call, the Gateway immediately rejects the request with an authentication error."*

### Scene 13: Disable Upstream Server
> *"If an admin disables an upstream server, its tools disappear from discovery in real time. The chat agent and external clients can no longer invoke them."*

### Scene 14: Pod Failure Isolation
> *"What happens if an upstream server crashes? Let's simulate a pod crash by killing the WooCommerce MCP pod.
> Notice: the Gateway remains healthy. Requests to Inventory and Analytics continue working with sub-50ms latency. The Gateway marks the dead server UNREACHABLE without taking down the platform."*

### Scene 15: Audit Logs
> *"Finally, every tool execution is permanently audited with duration, operator email, redacted inputs, and outcomes."*

### Scene 16-18: Security & Helm
> *"Security is built in with SSRF blocking, non-root containers, and NetworkPolicies. And everything deploys with a single Helm chart, transitioning seamlessly from local development to production k3s."*
