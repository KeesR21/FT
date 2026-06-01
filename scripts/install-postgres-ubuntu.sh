#!/bin/bash
# =============================================================================
#  FTPR Lions Academy — Install PostgreSQL on Ubuntu (Hostinger VPS)
#  Run once on the server as root:  bash install-postgres-ubuntu.sh
# =============================================================================

set -e

DB_NAME="academy"
DB_USER="academy"
# Change this password before going live — use a long random string.
DB_PASS="${ACADEMY_DB_PASSWORD:-academy_change_me_in_production}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▶  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }

if [ "$EUID" -ne 0 ]; then
  echo "Run as root: sudo bash install-postgres-ubuntu.sh"
  exit 1
fi

step "Installing PostgreSQL 16..."
apt-get update -qq
apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1

step "Creating database and user..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

# PostgreSQL 15+ grants on public schema
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
SQL

step "Allow local connections..."
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file')
if ! grep -q "academy" "$PG_HBA" 2>/dev/null; then
  echo "local   ${DB_NAME}   ${DB_USER}   scram-sha-256" >> "$PG_HBA"
  echo "host    ${DB_NAME}   ${DB_USER}   127.0.0.1/32   scram-sha-256" >> "$PG_HBA"
fi

systemctl enable postgresql
systemctl restart postgresql

echo ""
echo "============================================="
echo "  PostgreSQL is ready"
echo "============================================="
echo ""
echo "  Add this to /var/www/ftpr-lions/.env.local on the server:"
echo ""
echo "  USE_MOCK_DB=false"
echo "  DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo ""
warn "Replace academy_change_me_in_production with a strong password."
echo "  Or re-run with: ACADEMY_DB_PASSWORD='your-secret' bash install-postgres-ubuntu.sh"
echo ""
echo "  Then apply tables:"
echo "    cd /var/www/ftpr-lions && npm run db:setup"
echo ""
