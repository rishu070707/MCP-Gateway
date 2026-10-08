#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "Urumi AI — Local Cluster Deployment (Kind / Minikube)"
echo "============================================================"

NAMESPACE="urumi"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "Deploying Urumi Helm chart using values-local.yaml..."
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace "$NAMESPACE" \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-local.yaml

echo "Waiting for pods to be ready..."
kubectl rollout status deployment/urumi-gateway -n "$NAMESPACE" --timeout=120s || true
kubectl rollout status deployment/urumi-dashboard -n "$NAMESPACE" --timeout=120s || true

echo "Local deployment complete!"
echo "Dashboard: http://localhost:8080 (or port-forward)"
echo "Gateway MCP: http://localhost:8000/mcp"
