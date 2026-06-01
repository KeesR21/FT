# Database setup — FTPR Lions Academy

The app stores **players, payments, registrations, and CMS content** in **PostgreSQL**.

You can use any of these options:

| Option | Best for | Cost |
|--------|----------|------|
| **Supabase** | Easiest cloud DB, no server admin | Free tier |
| **Hostinger VPS + PostgreSQL** | Production on your VPS | Included with VPS |
| **Docker on your PC** | Local development | Free (needs Docker Desktop) |

---

## Option A — Supabase (recommended, ~10 minutes)

Supabase **is** PostgreSQL in the cloud. You already have a project URL in `.env.local`.

### 1. Open Supabase

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open project **ipmifxxnyhiixppkbpwx** (or create a new project if deleted)

### 2. Create tables (pick one way)

**Way 1 — Connection string (automatic)**

1. **Project Settings** → **Database** → **Connection string** → **URI** (Transaction pooler)
2. Copy the string and replace `[YOUR-PASSWORD]` with your database password
3. In `.env.local` on your PC (or server):

```env
USE_MOCK_DB=false
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres
```

4. Run:

```bash
npm run db:setup:supabase
```

**Way 2 — SQL Editor (manual)**

1. Supabase → **SQL Editor** → **New query**
2. Open `db/schema.sql` from this project, copy all, paste, **Run**

### 3. Verify

```bash
npm run db:verify
```

### 4. Restart the app

```bash
npm run dev
```

---

## Option B — PostgreSQL on Hostinger VPS

When your site runs on a Hostinger VPS, install Postgres on the same server.

### 1. SSH into the VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Install PostgreSQL

```bash
cd /var/www/ftpr-lions
bash scripts/install-postgres-ubuntu.sh
```

Use a strong password:

```bash
ACADEMY_DB_PASSWORD='your-long-secret-here' bash scripts/install-postgres-ubuntu.sh
```

### 3. Add to server `.env.local`

```env
USE_MOCK_DB=false
DATABASE_URL=postgresql://academy:your-long-secret-here@127.0.0.1:5432/academy
```

### 4. Create tables

```bash
cd /var/www/ftpr-lions
npm run db:setup
pm2 restart ftpr-lions
```

---

## Option C — Local PostgreSQL with Docker (your PC)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. In the project folder:

```bash
npm run db:compose:up
```

3. In `.env.local`:

```env
USE_MOCK_DB=false
DATABASE_URL=postgresql://academy:academy@127.0.0.1:5432/academy
```

4. Create tables:

```bash
npm run db:setup
npm run dev
```

---

## What is NOT in PostgreSQL yet

These still use files on disk (normal for now):

- Admin login session (`public/uploads/admin-auth/`)
- Parent portal accounts (`public/uploads/parent-accounts/`)
- Weekly timetable (in-memory)
- Kit orders, some logs (JSON files)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `connect ECONNREFUSED 127.0.0.1:5432` | Postgres not running — start Docker or VPS postgres |
| `fetch failed` to Supabase | Check internet; confirm project is not paused in Supabase dashboard |
| `relation "players" does not exist` | Run `npm run db:setup` or paste `db/schema.sql` in Supabase SQL Editor |
| Site empty after switch | Mock data was in memory — re-add players or import via admin |

---

## Quick commands

```bash
npm run db:setup          # Apply schema (needs DATABASE_URL)
npm run db:setup:supabase # Schema + verify + seed CMS row
npm run db:verify         # Check Supabase tables
npm run db:compose:up     # Start local Docker Postgres
```
