# Football Academy Management Web App

Modern, low-cost, scalable platform for a football academy with:
- Public website pages
- Parent registration workflow
- Payment tracking and manual verification
- Role-based admin operations
- Automated email notification handlers

## Tech Stack
- Next.js (App Router) + TypeScript
- **PostgreSQL** via `DATABASE_URL` (`postgres` driver) — schema in `db/schema.sql`
- Optional Supabase REST adapter if `DATABASE_URL` is not set
- Email: Resend (fallback to console when not configured)
- In-memory mock DB when `USE_MOCK_DB=true` or no DB configured

## Features Implemented
- Public pages: Home, About, Teams, Fixtures, News, Gallery, Registration, Contact, Locations
- Registration API with age-group auto assignment from DOB
- Registration status approval/rejection endpoint with email notifications
- Payment API + verification endpoint + payment status classification
- Timetable API (create/list sessions by age group)
- Notification dispatch API (payment reminder + weekly timetable)
- Payment-approved + admission emails for parents
- Registration creates first-month payment request email (pending until admin verification)
- Timetable change emails (create/update/remove) by age group
- Timetable and parent email notifications are sent only to approved players with active paid membership
- Subscription expiry reminders (5 days, 2 days, same-day)
- Admin dashboard (totals, paid/unpaid/overdue, revenue)
- Admin reports API + export endpoints (CSV/Excel)
- Admin roster import (CSV/Excel) + downloadable upload template
- Finance module improvements:
  - statuses: unpaid / pending / paid / overdue
  - invoice generation + parent email
  - payment confirmation notes/method/reference
  - filtered exports and monthly financial summaries
  - optional parent proof submission endpoint (`POST /api/payments/:id/proof`)
  - registration fee and monthly membership payment are handled separately
- Role checks for protected API routes (`super_admin`, `editor`, `photographer`)

## Folder Structure
- `src/app/*` - Website pages and API routes
- `src/lib/*` - RBAC, utility logic, notifications, mock data layer
- `src/components/*` - Shared UI components
- `db/schema.sql` - PostgreSQL schema for production DB
- `.env.example` - Environment variable template

## Local Setup
1. Install Node.js 20+ and npm (and [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you want local Postgres).
2. In project root:
   - `npm install`
   - `npm run env:init` or copy `.env.example` → `.env.local`
3. **PostgreSQL (recommended)**  
   - Start local DB: `npm run db:compose:up`  
   - In `.env.local` set:  
     `DATABASE_URL=postgresql://academy:academy@127.0.0.1:5432/academy`  
   - Create tables: `npm run db:setup` (runs `db/schema.sql` once; use an **empty** database for first run)  
   - Do **not** set `USE_MOCK_DB=true` when using Postgres.
4. Fill remaining `.env.local` values (admin, JWT, fees, optional Resend).
5. Run the app: `npm run dev` → open `http://localhost:3001` (this repo uses **port 3001**).

### Hosted PostgreSQL (Neon, Railway, Supabase Postgres, etc.)
- Create a database and set `DATABASE_URL` to the connection string (add `?sslmode=require` if required).
- Run `npm run db:setup` once on that database.

### Without Docker
- Install Postgres locally, create a database and user, set `DATABASE_URL`, then `npm run db:setup`.

## Environment Variables
Copy from `.env.example`. Important keys:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | **Primary** — direct PostgreSQL connection (wins over Supabase API) |
| `USE_MOCK_DB` | `true` only for in-memory mode / tests |
| `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | Optional; used only if `DATABASE_URL` is unset |
| `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin session |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email (optional in dev) |
| `NOTIFICATIONS_CRON_SECRET` | Cron header for `/api/notifications/subscription-expiry` |
| `REGISTRATION_FEE_AMOUNT`, `MONTHLY_FEE_AMOUNT`, `PAYMENT_CURRENCY` | Finance defaults |

## Database scripts
- `npm run db:compose:up` / `npm run db:compose:down` — local Postgres (Docker)
- `npm run db:setup` — apply full `db/schema.sql` (requires `DATABASE_URL`)
- `npm run db:migrate:integrity` — apply incremental indexes only (legacy DBs); fresh installs use `db:setup` only

`db:setup` is meant for an **empty** database. If you previously created `parents` with `CONSTRAINT uq_parents_email` and hit a conflict when re-applying, drop that constraint once (`ALTER TABLE parents DROP CONSTRAINT IF EXISTS uq_parents_email;`) — the schema now relies on `idx_parents_email_lower` for case-insensitive uniqueness.

## Admin Login
- Admin route: `http://localhost:3001/admin`
- Login route: `http://localhost:3001/admin/login`
- Default local credentials (change in `.env.local`):
  - Email: `admin@ftprlions.com`
  - Password: `admin123`

## Production Notes
- Use `DATABASE_URL` pointing at production PostgreSQL; run `npm run db:setup` on a new database or migrate carefully on existing data.
- Add auth provider (Supabase Auth or JWT middleware) if you need multi-user admin beyond env-based login.
- Schedule notification jobs using Vercel Cron / Supabase Edge Functions:
  - Weekly Sunday timetable emails
  - 1-day and 1-hour training/match reminders
  - Payment due/overdue reminders
- Use Cloudinary/Supabase Storage for player and gallery image uploads.

## Example API Endpoints
- `POST /api/registrations`
- `PATCH /api/registrations/:id/status`
- `GET /api/payments`
- `POST /api/payments`
- `PATCH /api/payments/:id/verify`
- `GET /api/timetable?ageGroup=U9`
- `POST /api/timetable`
- `POST /api/notifications/dispatch`
- `POST /api/notifications/subscription-expiry`
- `GET /api/admin/reports`
- `GET /api/admin/export?dataset=players|payments|financial|registrations&format=csv|xlsx`
- `GET /api/admin/roster/template`
- `POST /api/admin/roster/upload`

## Security Checklist (next step)
- Enforce authenticated sessions and signed JWTs
- Add row-level security (RLS) for Supabase tables
- Apply rate limiting to public APIs
- Validate and sanitize all file uploads
