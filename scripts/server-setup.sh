#!/bin/bash
# =============================================================================
#  FTPR Lions Academy — Initial Server Setup
#  Run this ONCE on a fresh Hostinger Ubuntu 22.04 VPS.
#  Usage:  bash server-setup.sh
# =============================================================================

set -e  # Stop immediately if any command fails

APP_DIR="/var/www/ftpr-lions"
REPO_URL="https://github.com/KeesR21/FT.git"
APP_NAME="ftpr-lions"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step()  { echo -e "\n${GREEN}▶  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $1${NC}"; }
error() { echo -e "${RED}✖  $1${NC}"; exit 1; }
ok()    { echo -e "${GREEN}✔  $1${NC}"; }

# ── Root check ───────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Please run as root:  sudo bash server-setup.sh"
fi

echo ""
echo "============================================="
echo "  FTPR Lions Academy — Server Setup"
echo "============================================="

# ── 1. System update ─────────────────────────────────────────────────────────
step "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
ok "System updated"

# ── 2. Node.js 20 ────────────────────────────────────────────────────────────
step "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1
ok "Node.js $(node -v) installed"

# ── 3. Git, Nginx, Certbot ────────────────────────────────────────────────────
step "Installing Git, Nginx, Certbot..."
apt-get install -y git nginx certbot python3-certbot-nginx ufw > /dev/null 2>&1
ok "Git, Nginx, Certbot installed"

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
step "Installing PM2 process manager..."
npm install -g pm2 > /dev/null 2>&1
ok "PM2 $(pm2 -v) installed"

# ── 5. Firewall ───────────────────────────────────────────────────────────────
step "Configuring firewall..."
ufw allow OpenSSH   > /dev/null 2>&1
ufw allow 'Nginx Full' > /dev/null 2>&1
ufw --force enable  > /dev/null 2>&1
ok "Firewall enabled (SSH + HTTP/HTTPS open)"

# ── 6. Clone repo ─────────────────────────────────────────────────────────────
step "Cloning repository..."
mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
  warn "Directory $APP_DIR already exists — pulling latest instead"
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
ok "Repository ready at $APP_DIR"

# ── 7. Environment file ──────────────────────────────────────────────────────
step "Setting up environment variables..."
if [ ! -f "$APP_DIR/.env.local" ]; then
  cat > "$APP_DIR/.env.local" << 'ENVEOF'
# ── Required — fill these in ──────────────────────────────────────────────
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=ChangeThisPassword123!
JWT_SECRET=change-this-to-a-long-random-secret-at-least-32-chars

# ── Optional database (leave blank to use file storage) ───────────────────
# DATABASE_URL=postgresql://user:password@host:5432/dbname

# ── Node environment ──────────────────────────────────────────────────────
NODE_ENV=production
ENVEOF
  echo ""
  warn "⚠  IMPORTANT: Edit your environment file now before continuing!"
  warn "   Run:  nano $APP_DIR/.env.local"
  warn "   Fill in ADMIN_EMAIL, ADMIN_PASSWORD, and JWT_SECRET"
  echo ""
  read -p "Press ENTER when you have saved your .env.local file..."
else
  ok ".env.local already exists — skipping"
fi

# ── 8. Install dependencies & build ──────────────────────────────────────────
step "Installing npm packages..."
cd "$APP_DIR"
npm install --production=false 2>&1 | tail -5
ok "Packages installed"

step "Building production app (this takes 2–3 minutes)..."
npm run build
ok "Build complete"

# ── 9. Ensure uploads directory persists ─────────────────────────────────────
step "Setting up persistent uploads directory..."
mkdir -p "$APP_DIR/public/uploads/admin-auth"
mkdir -p "$APP_DIR/public/uploads/parent-accounts"
mkdir -p "$APP_DIR/public/uploads/activity-logs"
chown -R www-data:www-data "$APP_DIR/public/uploads" 2>/dev/null || true
ok "Uploads directory ready"

# ── 10. PM2 start ────────────────────────────────────────────────────────────
step "Starting app with PM2..."
cd "$APP_DIR"
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start npm --name "$APP_NAME" -- start -- -p 3000
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash
ok "App running with PM2"

# ── 11. Nginx config ──────────────────────────────────────────────────────────
step "Configuring Nginx..."
read -p "Enter your domain name (e.g. ftprlions.com): " DOMAIN
DOMAIN=$(echo "$DOMAIN" | tr -d ' ')

cat > "$NGINX_CONF" << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1000;

    # Static Next.js files — long cache
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Uploaded media — moderate cache
    location /uploads/ {
        root $APP_DIR/public;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Everything else → Next.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
ok "Nginx configured for $DOMAIN"

# ── 12. SSL certificate ───────────────────────────────────────────────────────
step "Installing SSL certificate..."
read -p "Enter your email for SSL certificate alerts: " SSL_EMAIL
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --email "$SSL_EMAIL" \
  --redirect
ok "SSL certificate installed — site is now HTTPS"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo -e "${GREEN}  ✅  Setup complete!${NC}"
echo "============================================="
echo ""
echo "  🌐  Your site:     https://$DOMAIN"
echo "  🔐  Admin panel:   https://$DOMAIN/admin"
echo "  📁  App directory: $APP_DIR"
echo ""
echo "  Useful commands:"
echo "    pm2 status              — check if app is running"
echo "    pm2 logs ftpr-lions     — view live logs"
echo "    bash /var/www/ftpr-lions/scripts/deploy.sh  — update site"
echo ""
