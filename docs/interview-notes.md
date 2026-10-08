# Technical Interview Preparation Guide: Urumi AI Team MCP Gateway

This document provides Staff Software Engineer-level technical rationale, architectural trade-offs, and deep-dive answers for engineering interviews.

---

## 1. Architectural Foundations

### Why MCP (Model Context Protocol)?
- **Problem**: Prior to MCP, every AI integration required bespoke function calling wrappers, ad-hoc JSON schemas, and tightly coupled SDKs that broke whenever downstream APIs updated.
- **Solution**: MCP introduces an open, standardized protocol for AI models to discover, inspect, and invoke capabilities (Tools, Resources, Prompts) across language and network boundaries.
- **Why it matters**: It decouples the AI model provider from the enterprise microservices ecosystem.

### Why Streamable HTTP over stdio?
- `stdio` is designed for local desktop development where the host spawns a sub-process (e.g. Claude Desktop spawning local node scripts).
- In Kubernetes, components are distributed across pods, nodes, and namespaces. Streamable HTTP (JSON-RPC 2.0 over HTTP POST / SSE) enables:
  1. Standard TCP/IP routing across cluster networks.
  2. Stateless Horizontal Pod Autoscaling (HPA) and load balancing.
  3. Reconnection resilience across transient pod restarts.

### Why FastAPI & Python 3.12?
- **Asynchronous I/O**: High-concurrency reverse-proxying across multiple upstream HTTP MCP servers using Python `asyncio` and `httpx`.
- **Type Safety & Schema Validation**: Pydantic v2 natively models JSON-RPC 2.0 payloads and MCP tool schemas with Rust-backed performance.
- **AI Ecosystem Interoperability**: Seamless integration with OpenAI, LangChain, Anthropic, and open-source inference endpoints.

### Why PostgreSQL for the Gateway?
- Relational integrity is mandatory for team RBAC, hashed API key attribution, and immutable audit logs.
- Compound indexing (`ix_audit_user_timestamp`, `ix_audit_server_timestamp`) guarantees sub-millisecond audit querying even under millions of tool invocations.

### Why Helm (and why no Kustomize)?
- **Configurability**: A single umbrella chart with parameterised values files (`values-local.yaml` for Minikube/Kind vs `values-prod.yaml` for k3s) eliminates manifest duplication.
- **Lifecycle Management**: Atomic upgrades (`helm upgrade --wait`), revision tracking, and instant zero-downtime rollback (`helm rollback`).

---

## 2. Gateway Core Mechanisms

### How Tool Aggregation Works
1. Gateway queries `tools/list` on all enabled upstream servers.
2. Tools are mapped into a unified catalog table.
3. When external clients or the internal AI Chat Agent call `tools/list`, the Gateway filters tools based on the user's role (`ADMIN` vs `MEMBER`) and server enabled state.

### Tool Collision Strategy
- Multiple upstreams frequently share common tool names (e.g. `get_orders` on both WooCommerce and Inventory).
- **Strategy**: Mandatory namespacing prefix `<server_slug>__<tool_name>`.
- **Routing**: Gateway splits on the first `__` delimiter to resolve the target server slug and original tool name.

### Authentication & API Key Hashing
- Format: `umcp_<48_char_random_hex>`.
- **Security**: The Gateway computes and stores ONLY the SHA-256 hash (`key_hash`). Plaintext keys are never stored in the database.
- **One-Time Reveal**: Upon generation, the raw key is returned once in the HTTP response and never accessible again.

### RBAC Enforcement
- Role checks occur strictly server-side:
  - `ADMIN`: Full CRUD on upstream servers, team user management, global audit logs.
  - `MEMBER`: Tool execution, chat access, self-service API key generation/revocation.

### Credential Isolation
- Upstream WooCommerce credentials (`ck_*`, `cs_*`) and bearer tokens are stored server-side.
- The Gateway injects these credentials as authorization headers during dispatch.
- Neither the browser UI nor external MCP clients ever receive upstream credentials.

---

## 3. Resiliency & Failure Isolation

### Timeouts
- **Connect Timeout (3s)**: Prevents pod restarts or unroutable DNS from blocking event loops.
- **Request Timeout (15s)**: Prevents hanging database queries from starving gateway worker threads.

### Upstream Pod Crash / Dead Upstream
- If WooCommerce MCP pod dies:
  1. Connection fails fast (3s timeout).
  2. Gateway marks server status as `UNREACHABLE`.
  3. Gateway logs a failed audit record with clear error messaging.
  4. Other upstream servers (Inventory, Analytics) continue serving requests normally.

---

## 4. Security & Hardening

### Server-Side Request Forgery (SSRF)
- Because Admins can register custom upstream URLs, SSRF is a primary threat.
- **Mitigation**:
  1. Whitelist `http` and `https` schemes only.
  2. Blacklist link-local cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
  3. Deny Kubernetes control plane addresses (`kubernetes.default.svc`, port `6443`).
  4. In strict mode, deny RFC 1918 private IPs unless explicitly listed in `SSRF_ALLOWED_INTERNAL_HOSTS`.

### Prompt Injection & Tool Calling Safeguards
- AI agent executes tools strictly under the permissions of the authenticated user.
- If a prompt attempts to invoke administrative operations through a Member session, the Gateway RBAC rejects the call.

### Network Isolation via NetworkPolicies
- Upstream MCP servers and databases are blocked from accepting external traffic.
- Only pods with label `app.kubernetes.io/component: gateway` can establish TCP connections to upstream ports.

---

## 5. Scaling & Enterprise Evolution

### Scaling to Hundreds of Tools
- In large enterprises, sending hundreds of tool schemas in every LLM context window exhausts token limits and increases latency.
- **Evolution**:
  1. **Semantic Tool Search**: Implement vector embeddings for tool descriptions; retrieve only the top 5-10 relevant tools based on user prompt semantics.
  2. **Hierarchical Routing**: Use a meta-tool (e.g. `query_subsystem`) that routes queries to domain-specific sub-gateways.

### Multi-Tenancy & Enterprise Single Sign-On (SSO)
- Add tenant isolation (`tenant_id`) across all models (`users`, `servers`, `audit_logs`).
- Integrate OAuth2 / OIDC providers (Okta, Azure AD, Google Workspace) via standard OpenID Connect endpoints.
