#!/bin/bash
# =============================================================================
#  FTPR Lions Academy — Deploy / Update Script
#  Run this every time you push new code to GitHub.
#  Usage:  bash /var/www/ftpr-lions/scripts/deploy.sh
# =============================================================================

set -e

APP_DIR="/var/www/ftpr-lions"
APP_NAME="ftpr-lions"
BACKUP_DIR="/var/backups/ftpr-lions"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step()  { echo -e "\n${GREEN}▶  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $1${NC}"; }
ok()    { echo -e "${GREEN}✔  $1${NC}"; }
error() { echo -e "${RED}✖  $1${NC}"; exit 1; }

echo ""
echo "============================================="
echo "  FTPR Lions — Deploying Update"
echo "  $(date '+%d %b %Y %H:%M:%S')"
echo "============================================="

cd "$APP_DIR" || error "App directory not found: $APP_DIR"

# ── 1. Backup uploads (keeps your data safe during deploy) ───────────────────
step "Backing up uploads data..."
mkdir -p "$BACKUP_DIR"
if [ -d "$APP_DIR/public/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C "$APP_DIR/public" uploads
  ok "Backup saved: $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"
  # Keep only last 5 backups
  ls -t "$BACKUP_DIR"/uploads_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi

# ── 2. Pull latest code ───────────────────────────────────────────────────────
step "Pulling latest code from GitHub..."
git fetch origin main
CURRENT=$(git rev-parse HEAD)
LATEST=$(git rev-parse origin/main)

if [ "$CURRENT" = "$LATEST" ]; then
  warn "Already up to date — no new commits to deploy"
  echo ""
  echo "  Current version: $(git log -1 --format='%h %s')"
  echo "  Run with --force to redeploy anyway: bash deploy.sh --force"
  if [ "$1" != "--force" ]; then
    exit 0
  fi
fi

git pull origin main
ok "Code updated to: $(git log -1 --format='%h %s')"

# ── 3. Install any new packages ───────────────────────────────────────────────
step "Installing dependencies..."
npm install --production=false 2>&1 | tail -3
ok "Dependencies ready"

# ── 4. Build ──────────────────────────────────────────────────────────────────
step "Building production app..."
npm run build
ok "Build complete"

# ── 5. Reload app (zero-downtime) ────────────────────────────────────────────
step "Reloading app..."
pm2 reload "$APP_NAME" --update-env
ok "App reloaded"

# ── 6. Health check ───────────────────────────────────────────────────────────
step "Running health check..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "307" ] || [ "$HTTP_STATUS" = "301" ]; then
  ok "Health check passed (HTTP $HTTP_STATUS)"
else
  warn "Health check returned HTTP $HTTP_STATUS — checking logs..."
  pm2 logs "$APP_NAME" --lines 20 --nostream
  echo ""
  warn "If the site looks broken, restore from backup:"
  warn "  tar -xzf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz -C $APP_DIR/public"
  warn "  pm2 reload $APP_NAME"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo -e "${GREEN}  ✅  Deploy complete!${NC}"
echo "============================================="
echo ""
echo "  Deployed: $(git log -1 --format='%h — %s')"
echo "  Time:     $(date '+%H:%M:%S')"
echo ""
echo "  Commands:"
echo "    pm2 logs $APP_NAME        — view live logs"
echo "    pm2 status                — check process health"
echo "    bash scripts/health.sh    — detailed health check"
echo ""
