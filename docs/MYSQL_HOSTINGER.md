# MySQL on Hostinger — FTPR Lions Academy

The app now supports **MySQL** (ideal for Hostinger shared/VPS hosting).

---

## Step 1 — Create a MySQL database in Hostinger

1. Log in to **hPanel**
2. Go to **Databases** → **MySQL Databases**
3. Create a new database (e.g. `u123456789_academy`)
4. Create a user and password — grant **All privileges** on that database
5. Note these four values:
   - Host (often `localhost` on the server, or `127.0.0.1`)
   - Database name
   - Username
   - Password

---

## Step 2 — Configure `.env.local` (server or local)

```env
USE_MOCK_DB=false

# Hostinger example (on the VPS/server itself):
DATABASE_URL=mysql://u123456789_user:YourPassword@localhost:3306/u123456789_academy
```

Replace user, password, and database name with your real values.

**Special characters in password?** URL-encode them (`@` → `%40`, `#` → `%23`, etc.).

You can remove or ignore Supabase variables when using MySQL only.

---

## Step 3 — Create tables

**On the server** (SSH) or locally if MySQL is reachable:

```bash
cd /var/www/ftpr-lions
npm run db:setup:mysql
```

**Or use phpMyAdmin:**

1. Hostinger → **Databases** → **phpMyAdmin**
2. Select your database
3. **SQL** tab → paste all of `db/schema.mysql.sql` → **Go**

---

## Step 4 — Restart the app

```bash
npm run build
pm2 restart ftpr-lions
```

Local development:

```bash
npm run dev
```

---

## Verify it works

- Open **Admin** → **Players** / **Applications** — should load without DB errors
- Register a test player — should persist after refresh

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ECONNREFUSED` | Wrong host/port — use `localhost` on Hostinger server |
| `Access denied` | Wrong user/password in `DATABASE_URL` |
| `Unknown database` | Create the database in hPanel first |
| `Table doesn't exist` | Run `npm run db:setup:mysql` or paste `schema.mysql.sql` |

---

## What uses MySQL vs files

| MySQL | Still JSON files |
|-------|------------------|
| Players, parents, payments | Admin login session |
| Registrations, messages | Parent portal accounts |
| CMS site content | Weekly timetable, kit orders |
