#!/bin/bash
# =============================================================================
#  FTPR Lions — Hostinger Node.js deploy (run from the app folder over SSH)
#    cd /home/USER/domains/ftprlionsacademy.com/nodejs
#    bash scripts/hostinger-deploy.sh
# =============================================================================
set -e

echo "▶  Locating Node.js binary..."
NODE_BIN="$(dirname "$(find /opt/alt -name node -type f 2>/dev/null | head -1)")"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN/node" ]; then
  # Fallbacks: maybe node is already on PATH
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(dirname "$(command -v node)")"
  else
    echo "✖  Could not find node. Run: find /opt -name node -type f 2>/dev/null"
    exit 1
  fi
fi
export PATH="$NODE_BIN:$PATH"
echo "✔  Using node: $(node -v)  npm: $(npm -v)"

echo "▶  Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✔  Code at: $(git log -1 --oneline)"

echo "▶  Cleaning old build + modules..."
rm -rf .next node_modules/.cache

echo "▶  Installing dependencies (scripts disabled for shared hosting)..."
export MONGOMS_DISABLE_POSTINSTALL=1
npm install --ignore-scripts --no-audit --no-fund

echo "▶  Building production app..."
npm run build

echo ""
echo "============================================="
echo "  ✅  Build complete."
echo "  Now click 'Restart Application' in hPanel → Node.js"
echo "============================================="
