#!/usr/bin/env bash
# Puts an HTTPS domain in front of the running bidigo-frontend container (via the shared apps-edge nginx).
# Run AFTER the DNS record points to the VPS (72.61.177.37), e.g.:
#   DOMAIN=test.bidigo.pl bash deploy/setup-https.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:-72.61.177.37}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/memorlee-deploy}"
DOMAIN="${DOMAIN:-bidigo.memorlee.app}"
CERT_EMAIL="${CERT_EMAIL:-admin@memorlee.app}"
APP_CONTAINER="${APP_CONTAINER:-bidigo-frontend}"

ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail

# TLS certificate
certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --non-interactive --agree-tos -m ${CERT_EMAIL} || {
  echo "Certbot failed — upewnij się, że DNS wskazuje na ${VPS_HOST}"
  exit 1
}

# Append HTTPS server block if missing
if ! grep -q "${DOMAIN}" /opt/apps-edge/apps-edge-nginx.conf; then
  # add the domain to the port-80 server_name list (ACME challenge + redirect), whatever other names it already has
  # Edit IN PLACE (write through the same inode): the file is bind-mounted into the apps-edge container, and
  # `sed -i` would replace it with a new file the container never sees.
  # only the FIRST matching server_name line (the port-80 block): a global replace also hit the test.memorlee.app
  # HTTPS block, which then claimed this domain with the wrong certificate
  sed "0,/\\(server_name [^;]*test\\.memorlee\\.app[^;]*\\);/s//\\1 ${DOMAIN};/" /opt/apps-edge/apps-edge-nginx.conf > /tmp/apps-edge-nginx.new
  cat /tmp/apps-edge-nginx.new > /opt/apps-edge/apps-edge-nginx.conf

  cat >> /opt/apps-edge/apps-edge-nginx.conf << 'NGINXEOF'

server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    location / {
        set \$fe ${APP_CONTAINER}:80;
        proxy_pass http://\$fe;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

  docker exec apps-edge nginx -t
  docker exec apps-edge nginx -s reload
fi

# Fail loudly when the container does not actually serve the new block
docker exec apps-edge grep -q "server_name ${DOMAIN}" /etc/nginx/nginx.conf || { echo "apps-edge does not see the new config: docker restart apps-edge"; exit 1; }

echo "✓ https://${DOMAIN} should be live"
EOF
