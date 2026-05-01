# Staging Go-Live Checklist (Payments + Notifications)

## 1) Environment Variables

- `DATABASE_URL` set to staging DB (Supabase Postgres connection string or direct Postgres).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET` set for staging.
- `REGISTRATION_FEE_AMOUNT`, `MONTHLY_FEE_AMOUNT`, `PAYMENT_CURRENCY` set.
- `RESEND_API_KEY` and `EMAIL_FROM` configured.
- `NOTIFICATIONS_CRON_SECRET` configured.

## 2) Database schema

- **New / empty database:** run once:
  - `npm run db:setup`  
  (applies full `db/schema.sql` using `DATABASE_URL`.)
- **Existing database** that already has base tables but missing integrity indexes:
  - `npm run db:migrate:integrity`
- Validate indexes exist:
  - parent dedupe: `idx_parents_email_lower`, `uq_parents_phone_digits`
  - player dedupe: `uq_players_parent_name_dob`
  - invoice dedupe: `uq_payments_player_period_open`

## 3) Resend Email Checks

- Confirm sender domain for `EMAIL_FROM` is verified in Resend.
- Trigger a registration and verify:
  - registration fee request email sent.
- Confirm registration fee and verify:
  - admission email sent.
  - monthly invoice email sent.
- Confirm monthly membership fee and verify:
  - payment-approved email includes membership start/end dates.

## 4) Cron Checks

- Configure scheduler for:
  - `POST /api/notifications/subscription-expiry` with header `x-cron-secret: <NOTIFICATIONS_CRON_SECRET>`
- Suggested frequency:
  - `subscription-expiry`: daily (morning local time).
- Optional overdue reminders:
  - `POST /api/notifications/dispatch` payload `{ "type": "payment_overdue" }` (run with admin auth context).

## 5) Functional Smoke

- Parent registers child A and child B with same email/phone.
- Verify single parent record reused.
- Verify each child has separate registration + monthly invoices.
- Pay/approve child A only; child B remains unpaid.
- Verify child A receives membership/timetable notifications and child B does not.

## 6) Automated Tests

- Run API integration tests:
  - `npm test`
- Run Playwright smoke:
  - `npm run test:e2e` (first time: `npm run test:e2e:install`)

