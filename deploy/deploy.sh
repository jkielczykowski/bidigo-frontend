#!/usr/bin/env bash
# Deploys the web app (nginx + built React app) to the VPS as container `bidigo-frontend`.
# The search API it proxies (/api/search → bidigo-search) and the mail worker come from bidigo-backend.
# Where it goes: TARGET (default test) picks deploy/targets/<TARGET>.env — server, user, port, public
# URL. Secrets: locally from .env (test) or .env.<TARGET>; in GitHub Actions from the environment
# named like the target (see .github/SECRETS.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${TARGET:-test}"
TARGET_FILE="${ROOT}/deploy/targets/${TARGET}.env"
[[ -f "${TARGET_FILE}" ]] || { echo "No ${TARGET_FILE} — create it from deploy/targets/production.env.example"; exit 1; }

ENV_FILE="${ROOT}/.env"
[[ "${TARGET}" != "test" ]] && ENV_FILE="${ROOT}/.env.${TARGET}"
set -a
# shellcheck disable=SC1090
[[ -f "${ENV_FILE}" ]] && source "${ENV_FILE}"
# The target file comes last: its server settings win over anything in .env
# shellcheck disable=SC1090
source "${TARGET_FILE}"
set +a

VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/memorlee-deploy}"
APP_NAME="${APP_NAME:-bidigo-frontend}"
REMOTE_DIR="/opt/${APP_NAME}"
: "${VPS_HOST:?VPS_HOST missing in ${TARGET_FILE}}"
: "${HOST_HTTP_PORT:?HOST_HTTP_PORT missing in ${TARGET_FILE}}"
echo "→ Target: ${TARGET} (${VPS_USER}@${VPS_HOST}, port ${HOST_HTTP_PORT})"

VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}"
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"
# Optional: Cloudflare Turnstile site key (public); empty = no captcha on sign-up
VITE_TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-}"
if [[ -z "${VITE_SUPABASE_URL}" || -z "${VITE_SUPABASE_ANON_KEY}" ]]; then
  echo "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env or environment)"
  exit 1
fi

SSH="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new"

echo "→ Syncing files to ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
rsync -az --delete \
  -e "${SSH}" \
  --exclude .git \
  --exclude .github \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  --exclude smoke \
  --exclude landing \
  --exclude deploy \
  "${ROOT}/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

echo "→ Building and starting ${APP_NAME} on the VPS"
${SSH} "${VPS_USER}@${VPS_HOST}" bash -s <<REMOTE
set -euo pipefail
docker network create apps-net 2>/dev/null || true
cd ${REMOTE_DIR}

docker build \
  --build-arg VITE_SUPABASE_URL='${VITE_SUPABASE_URL}' \
  --build-arg VITE_SUPABASE_ANON_KEY='${VITE_SUPABASE_ANON_KEY}' \
  --build-arg VITE_TURNSTILE_SITE_KEY='${VITE_TURNSTILE_SITE_KEY}' \
  -t ${APP_NAME}:latest .

cat > docker-compose.prod.yml << 'COMPOSE'
services:
  frontend:
    image: bidigo-frontend:latest
    container_name: bidigo-frontend
    restart: always
    ports:
      - "${HOST_HTTP_PORT}:80"
    networks:
      - apps-net
networks:
  apps-net:
    external: true
COMPOSE

# Monorepo era: the web container was called janusz-licytuje and held port ${HOST_HTTP_PORT}
docker rm -f janusz-licytuje 2>/dev/null || true
# Bidaro era: the web container was bidaro-frontend (/opt/bidaro-frontend), same port
docker rm -f bidaro-frontend 2>/dev/null || true
rm -rf /opt/bidaro-frontend
docker compose -p ${APP_NAME} -f docker-compose.prod.yml up -d --force-recreate --remove-orphans
REMOTE

echo "✓ Bidigo web: ${PUBLIC_URL}"
