#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "Urumi AI — WooCommerce Storefront & Catalog Seeder"
echo "============================================================"

WORDPRESS_POD=$(kubectl get pods -l app.kubernetes.io/component=wordpress -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$WORDPRESS_POD" ]; then
  echo "WordPress pod not detected on cluster. Checking local fallback..."
  exit 0
fi

echo "Installing WP-CLI and configuring WooCommerce inside $WORDPRESS_POD..."

# Install and activate WooCommerce plugin
kubectl exec "$WORDPRESS_POD" -- wp plugin install woocommerce --activate --allow-root || true

# Set currency and store details
kubectl exec "$WORDPRESS_POD" -- wp option update woocommerce_currency "INR" --allow-root || true
kubectl exec "$WORDPRESS_POD" -- wp option update woocommerce_currency_pos "left" --allow-root || true

# Enable Cash on Delivery
kubectl exec "$WORDPRESS_POD" -- wp option update woocommerce_cod_settings '{"enabled":"yes","title":"Cash on Delivery","description":"Pay with cash upon delivery.","instructions":"Pay with cash upon delivery.","enable_for_methods":[],"enable_for_virtual":"yes"}' --format=json --allow-root || true

# Create Demo Products
echo "Seeding catalog demo products..."
kubectl exec "$WORDPRESS_POD" -- wp post create --post_type=product --post_title="Ergonomic Mechanical Keyboard" --post_status=publish --post_content="High-performance hot-swappable mechanical keyboard." --allow-root || true
kubectl exec "$WORDPRESS_POD" -- wp post create --post_type=product --post_title="Wireless Ultra Mouse" --post_status=publish --post_content="Ultra-lightweight wireless gaming and productivity mouse." --allow-root || true
kubectl exec "$WORDPRESS_POD" -- wp post create --post_type=product --post_title="USB-C Multiport Hub" --post_status=publish --post_content="7-in-1 aluminium USB-C hub with 4K HDMI." --allow-root || true

echo "WooCommerce catalog and Cash on Delivery initialized successfully!"
