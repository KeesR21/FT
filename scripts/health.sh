#!/bin/bash
# =============================================================================
#  FTPR Lions Academy — Health Check
#  Run anytime to see the status of your server and app.
#  Usage:  bash /var/www/ftpr-lions/scripts/health.sh
# =============================================================================

APP_DIR="/var/www/ftpr-lions"
APP_NAME="ftpr-lions"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✔  $1${NC}"; }
fail() { echo -e "  ${RED}✖  $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠  $1${NC}"; }
info() { echo -e "  ${BLUE}ℹ  $1${NC}"; }

echo ""
echo "============================================="
echo "  FTPR Lions — Health Check"
echo "  $(date '+%d %b %Y %H:%M:%S')"
echo "============================================="

# ── App process ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● App Process${NC}"
PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  try {
    const list = JSON.parse(d);
    const app = list.find(p => p.name === '$APP_NAME');
    if (!app) { console.log('not_found'); }
    else { console.log(app.pm2_env.status + ' ' + app.pid); }
  } catch(e) { console.log('error'); }
" 2>/dev/null || echo "error")

if echo "$PM2_STATUS" | grep -q "^online"; then
  PID=$(echo "$PM2_STATUS" | awk '{print $2}')
  pass "App is running (PID $PID)"
elif echo "$PM2_STATUS" | grep -q "not_found"; then
  fail "App not found in PM2 — run: pm2 start npm --name $APP_NAME -- start"
else
  fail "App status: $PM2_STATUS"
fi

RESTARTS=$(pm2 jlist 2>/dev/null | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  try {
    const list = JSON.parse(d);
    const app = list.find(p => p.name === '$APP_NAME');
    console.log(app ? app.pm2_env.restart_time : '?');
  } catch(e) { console.log('?'); }
" 2>/dev/null || echo "?")

if [ "$RESTARTS" != "?" ] && [ "$RESTARTS" -gt 10 ] 2>/dev/null; then
  warn "App has restarted $RESTARTS times — check logs: pm2 logs $APP_NAME"
else
  pass "Restart count: $RESTARTS"
fi

# ── HTTP response ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● HTTP Response${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ] || [ "$HTTP" = "307" ] || [ "$HTTP" = "301" ]; then
  pass "Local app responding (HTTP $HTTP)"
else
  fail "Local app not responding (HTTP $HTTP)"
fi

HTTPS_DOMAIN=$(grep server_name /etc/nginx/sites-enabled/* 2>/dev/null | grep -v '#' | awk '{print $2}' | head -1 | tr -d ';')
if [ -n "$HTTPS_DOMAIN" ]; then
  HTTPS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$HTTPS_DOMAIN" 2>/dev/null || echo "000")
  if [ "$HTTPS" = "200" ] || [ "$HTTPS" = "307" ] || [ "$HTTPS" = "301" ]; then
    pass "Public site responding at https://$HTTPS_DOMAIN (HTTP $HTTPS)"
  else
    warn "Public site returned HTTP $HTTPS for https://$HTTPS_DOMAIN"
  fi
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● Nginx${NC}"
if systemctl is-active --quiet nginx; then
  pass "Nginx is running"
else
  fail "Nginx is stopped — run: sudo systemctl start nginx"
fi

# ── SSL certificate ───────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● SSL Certificate${NC}"
CERT_FILE=$(find /etc/letsencrypt/live -name "cert.pem" 2>/dev/null | head -1)
if [ -n "$CERT_FILE" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  if [ "$DAYS_LEFT" -gt 30 ]; then
    pass "SSL valid for $DAYS_LEFT more days (expires $EXPIRY)"
  elif [ "$DAYS_LEFT" -gt 0 ]; then
    warn "SSL expires in $DAYS_LEFT days — renew soon: sudo certbot renew"
  else
    fail "SSL certificate expired! Run: sudo certbot renew"
  fi
else
  warn "No SSL certificate found — run setup script or: sudo certbot --nginx"
fi

# ── Disk space ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● Disk & Memory${NC}"
DISK_USED=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
if [ "$DISK_USED" -lt 80 ] 2>/dev/null; then
  pass "Disk: ${DISK_USED}% used (${DISK_FREE} free of ${DISK_TOTAL})"
elif [ "$DISK_USED" -lt 90 ] 2>/dev/null; then
  warn "Disk: ${DISK_USED}% used — consider clearing old backups"
else
  fail "Disk: ${DISK_USED}% used — critical! Free up space immediately"
fi

MEM_FREE=$(free -m | awk 'NR==2 {printf "%.0f", $7}')
MEM_TOTAL=$(free -m | awk 'NR==2 {printf "%.0f", $2}')
MEM_USED_PCT=$(free | awk 'NR==2 {printf "%.0f", ($3/$2)*100}')
if [ "$MEM_USED_PCT" -lt 80 ] 2>/dev/null; then
  pass "Memory: ${MEM_USED_PCT}% used (${MEM_FREE}MB free of ${MEM_TOTAL}MB)"
else
  warn "Memory: ${MEM_USED_PCT}% used — app may be slow"
fi

# ── Uploads directory ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● Data Files${NC}"
UPLOADS="$APP_DIR/public/uploads"
if [ -d "$UPLOADS" ]; then
  UPLOAD_SIZE=$(du -sh "$UPLOADS" 2>/dev/null | cut -f1)
  pass "Uploads directory exists ($UPLOAD_SIZE)"
else
  warn "Uploads directory missing — creating..."
  mkdir -p "$UPLOADS/admin-auth" "$UPLOADS/parent-accounts"
fi

CREDS="$UPLOADS/admin-auth/credentials.json"
if [ -f "$CREDS" ]; then
  pass "Admin credentials file exists"
else
  warn "No admin credentials yet — will be created on first login"
fi

# ── Latest deploy ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● Current Version${NC}"
cd "$APP_DIR" 2>/dev/null && \
  info "$(git log -1 --format='Commit: %h — %s (%cr)')" || \
  warn "Could not read git log"

# ── Backups ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}● Backups${NC}"
BACKUP_DIR="/var/backups/ftpr-lions"
if [ -d "$BACKUP_DIR" ]; then
  BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
  if [ "$BACKUP_COUNT" -gt 0 ]; then
    pass "$BACKUP_COUNT backup(s) stored — latest: $(basename "$LATEST_BACKUP")"
  else
    warn "No backups found — run deploy.sh to create one"
  fi
else
  warn "No backup directory — will be created on first deploy"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Done — check any ⚠ warnings above"
echo "============================================="
echo ""
echo "  Quick commands:"
echo "    pm2 logs $APP_NAME --lines 50   — recent logs"
echo "    pm2 restart $APP_NAME           — restart app"
echo "    bash scripts/deploy.sh          — deploy latest"
echo ""
