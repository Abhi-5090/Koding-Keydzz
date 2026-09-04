#!/usr/bin/env bash
#
# Generate a self-signed TLS certificate so the bundled nginx config can be
# brought up and TESTED locally.
#
# WHY THIS EXISTS
# ---------------
# nginx.conf serves HTTPS and expects fullchain.pem / privkey.pem in
# nginx/certs. A real certificate needs a real domain and cannot be issued from
# a repository, so without this script the whole TLS path was untestable until
# deploy day — which is exactly when you do not want to discover a
# configuration mistake.
#
# The certificate this produces is for LOCAL USE ONLY. Browsers will warn about
# it, and they should: it is self-signed. It exists so you can verify the proxy,
# the redirect, the security headers and the CSP end to end before you have a
# domain.
#
# FOR PRODUCTION, issue a real certificate instead:
#
#   # 1. Point your domain's A record at the server.
#   # 2. Issue a certificate (nginx must be reachable on port 80 for the
#   #    ACME challenge — the bundled config already leaves that path open):
#   certbot certonly --webroot -w ./nginx/certbot-webroot -d app.example.com
#   # 3. Point the compose volume at the issued files:
#   #    /etc/letsencrypt/live/app.example.com:/etc/nginx/certs:ro
#   # 4. Renewals: certbot renew && docker compose exec nginx nginx -s reload
#
# Usage:
#   ./nginx/generate-dev-certs.sh [hostname]      # default: localhost

set -euo pipefail

HOST="${1:-localhost}"
CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/certs"

mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
  echo "A certificate already exists at $CERT_DIR/fullchain.pem"
  echo "Delete it first if you want to regenerate:"
  echo "  rm -f \"$CERT_DIR\"/{fullchain,privkey}.pem"
  exit 0
fi

echo "Generating a self-signed certificate for '$HOST' …"

# A SAN entry is required — modern browsers ignore the legacy CN field, so a
# certificate without subjectAltName is rejected outright.
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/C=IN/ST=Local/L=Local/O=Koding Keydzz (development)/CN=$HOST" \
  -addext "subjectAltName=DNS:$HOST,DNS:*.$HOST,IP:127.0.0.1" \
  2>/dev/null

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

cat <<EOF

Done. Wrote:
  $CERT_DIR/fullchain.pem
  $CERT_DIR/privkey.pem

This is a DEVELOPMENT certificate — self-signed, so your browser will warn.
Never deploy it. See the header of this script for issuing a real one.

Bring the stack up and check the TLS path:
  docker compose up -d
  curl -kI https://localhost/                 # expect 200 + Strict-Transport-Security
  curl -I  http://localhost/                  # expect 301 to https
EOF
