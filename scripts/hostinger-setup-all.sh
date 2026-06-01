#!/bin/bash
# =============================================================================
#  FTPR Lions — Full Hostinger setup (MySQL + Next.js + PM2)
#  Run on the VPS after creating MySQL in hPanel:
#    bash scripts/hostinger-setup-all.sh
# =============================================================================

set -e

APP_DIR="/var/www/ftpr-lions"
APP_NAME="ftpr-lions"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step()  { echo -e "\n${GREEN}▶  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $1${NC}"; }
fail()  { echo -e "${RED}✖  $1${NC}"; exit 1; }

cd "$APP_DIR" 2>/dev/null || fail "App not found at $APP_DIR — clone the repo first."

if [ ! -f .env.local ]; then
  fail "Missing .env.local — copy .env.hostinger.example and fill in DATABASE_URL."
fi

# Load env for this script
set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a

if [ -z "$DATABASE_URL" ] || ! echo "$DATABASE_URL" | grep -qE '^mysql'; then
  fail "Set DATABASE_URL in .env.local first (mysql://user:pass@localhost:3306/database)"
fi

if ! grep -q '^USE_MOCK_DB=false' .env.local 2>/dev/null; then
  warn "Adding USE_MOCK_DB=false to .env.local"
  echo "USE_MOCK_DB=false" >> .env.local
fi

step "Installing Node dependencies…"
npm install

step "Creating MySQL tables…"
npm run db:setup:mysql

step "Building Next.js production app…"
npm run build

step "Restarting app with PM2…"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" -- start -- -p 3000
  pm2 save
fi

step "Health check…"
sleep 3
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$HTTP" = "200" ] || [ "$HTTP" = "307" ] || [ "$HTTP" = "301" ]; then
  echo -e "${GREEN}✔  App responding (HTTP $HTTP)${NC}"
else
  warn "App returned HTTP $HTTP — check: pm2 logs $APP_NAME"
fi

echo ""
echo "============================================="
echo -e "${GREEN}  Setup complete${NC}"
echo "============================================="
echo "  MySQL + Next.js + PM2 are configured."
echo "  Logs: pm2 logs $APP_NAME"
echo ""
