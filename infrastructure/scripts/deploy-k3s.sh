#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "Urumi AI — Production k3s Cluster Deployment"
echo "============================================================"

NAMESPACE="urumi-prod"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "Deploying production Helm release..."
helm upgrade --install urumi ./infrastructure/helm/urumi \
  --namespace "$NAMESPACE" \
  -f ./infrastructure/helm/urumi/values.yaml \
  -f ./infrastructure/helm/urumi/values-prod.yaml \
  --wait \
  --timeout 10m

echo "Production deployment succeeded!"
kubectl get pods,svc,ingress -n "$NAMESPACE"
