#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="your-tailscale-node-name.ts.net"
CERT_DIR="/etc/ssl/tailscale"

echo "==> Creating cert directory: $CERT_DIR"
sudo mkdir -p "$CERT_DIR"

echo "==> Fetching Tailscale TLS certificate for $HOSTNAME"
sudo tailscale cert \
  --cert-file "$CERT_DIR/$HOSTNAME.crt" \
  --key-file "$CERT_DIR/$HOSTNAME.key" \
  "$HOSTNAME"

# Caddy needs to read the key — keep owner root, group caddy, mode 640
if getent group caddy &>/dev/null; then
  sudo chown root:caddy "$CERT_DIR/$HOSTNAME.key"
  sudo chmod 640 "$CERT_DIR/$HOSTNAME.key"
else
  sudo chmod 644 "$CERT_DIR/$HOSTNAME.key"
fi
sudo chmod 644 "$CERT_DIR/$HOSTNAME.crt"

echo "==> Certs installed to $CERT_DIR"
echo ""
echo "Next steps:"
echo "  1. Install Caddy if needed:  sudo apt install -y caddy"
echo "  2. Start Caddy:              caddy run --config Caddyfile"
echo "  3. Start Next.js (port 4776): cd UI && npm run dev"
echo ""
echo "Access the app at: https://$HOSTNAME:4777"
