# Deployment Guide: Kubernetes & Helm (Local & Production k3s)

## 1. Prerequisites

- Kubernetes cluster (Kind, k3d, Minikube, or k3s) `v1.28+`
- `kubectl` client `v1.28+`
- `helm` `v3.12+`
- Ingress controller (e.g. `ingress-nginx` for local Kind, or built-in `traefik` for k3s)

---

## 2. Helm Architecture & Umbrella Chart

The deployment uses a single reusable umbrella Helm chart located in `infrastructure/helm/urumi/`.

### Directory Layout:
```
infrastructure/helm/urumi/
├── Chart.yaml              # Chart definition
├── values.yaml             # Base values & defaults
├── values-local.yaml       # Kind/k3d overrides (1 replica, relaxed SSRF)
├── values-prod.yaml        # Production k3s overrides (HA replicas, strict SSRF, TLS)
└── templates/
    ├── configmap.yaml
    ├── secrets.yaml
    ├── networkpolicy.yaml   # Upstream isolation
    ├── gateway-deployment.yaml
    ├── dashboard-deployment.yaml
    ├── woo-mcp-deployment.yaml
    ├── inventory-mcp-deployment.yaml
    ├── analytics-mcp-deployment.yaml
    ├── postgres-statefulset.yaml
    ├── wordpress-statefulset.yaml
    ├── mysql-statefulset.yaml
    └── ingress.yaml
```

---

## 3. Local Deployment (Kind / Minikube / k3d)

### Step 1: Create Namespace
```bash
kubectl create namespace urumi
```

### Step 2: Install Helm Release
```bash
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace urumi \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-local.yaml
```

### Step 3: Monitor Rollout
```bash
kubectl get pods -n urumi -w
```

### Step 4: Access Local Services
If not using an ingress controller on localhost, use port-forwarding:
```bash
# Dashboard Web UI (:8080)
kubectl port-forward svc/urumi-dashboard 8080:8080 -n urumi &

# MCP Gateway API & Streamable MCP (:8000)
kubectl port-forward svc/urumi-gateway 8000:8000 -n urumi &

# WooCommerce Storefront (:80)
kubectl port-forward svc/urumi-wordpress 8081:80 -n urumi &
```

---

## 4. Production Deployment on k3s

Production environments use `values-prod.yaml` which enables high-availability replica counts, Traefik ingress, and strict SSRF policy.

### Step 1: Deploy with Helm
```bash
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace urumi-prod \
  --create-namespace \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-prod.yaml \
  --wait \
  --timeout 10m
```

### Step 2: Zero-Downtime Rolling Upgrades
When releasing an updated version of the Gateway or Upstream MCP servers:
```bash
helm upgrade urumi ./infrastructure/helm/urumi \
  --namespace urumi-prod \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-prod.yaml \
  --set gateway.image.tag="v1.0.1"
```

### Step 3: Rollback Strategy
If an upgrade experiences issues:
```bash
# Check revision history
helm history urumi -n urumi-prod

# Rollback to revision 1 immediately
helm rollback urumi 1 -n urumi-prod
```

---

## 5. PersistentVolumes & Storage

The chart provisions three StatefulSets with `volumeClaimTemplates`:
1. `urumi-postgres`: Gateway users, keys, tools, and audit log persistence.
2. `urumi-mysql`: WordPress database tables (`wp_posts`, `wp_woocommerce_order_items`, etc.).
3. `urumi-wordpress`: Uploads, plugins, and themes under `/var/www/html/wp-content`.

On k3s, these bind automatically to the `local-path` storage provisioner.

---

## 6. Verifying Upstream Pod Failure Isolation (Flow G)

To prove failure isolation in Kubernetes:
```bash
# 1. Kill the WooCommerce MCP pod
kubectl delete pod -l app.kubernetes.io/component=woo-mcp -n urumi

# 2. Query Gateway health and tools
curl -s http://localhost:8000/health
# Result: {"status":"healthy", "service":"urumi-mcp-gateway"}

# 3. Query Inventory MCP via Gateway
curl -s -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer umcp_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"inventory__list_inventory","arguments":{}}}'
# Result: 200 OK with inventory records! Gateway and other servers remain fully operational.
```
