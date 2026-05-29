-- FTPR Lions Academy — PostgreSQL 14+ schema (direct Postgres, Neon, Railway, Docker, or Supabase Postgres).
--
-- Fresh database: set DATABASE_URL and run from project root:
--   npm run db:setup
--
-- Supabase: SQL Editor → paste this file → Run (or use npm run db:setup with the Postgres connection string).
-- The Next.js app connects with DATABASE_URL using the `postgres` driver (server-side only).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('super_admin', 'editor', 'photographer');
CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_status AS ENUM ('paid', 'not_paid', 'pending', 'overdue', 'expiring_soon');
CREATE TYPE player_status AS ENUM ('active', 'withdrawn');
CREATE TYPE session_kind AS ENUM ('training', 'match');
CREATE TYPE message_channel AS ENUM ('individual', 'group');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique email (app normalizes to lower on write; this enforces at DB level)
CREATE UNIQUE INDEX idx_parents_email_lower ON parents (lower(email));
CREATE UNIQUE INDEX uq_parents_phone_digits ON parents ((regexp_replace(phone_number, '\D', '', 'g')));

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  age_group TEXT NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL CHECK (height_cm > 0 AND height_cm < 320),
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 250),
  profile_photo_url TEXT,
  status player_status NOT NULL DEFAULT 'active',
  registration_status registration_status NOT NULL DEFAULT 'pending',
  development_notes TEXT,
  registration_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscription_valid_until DATE,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_for TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  due_date DATE NOT NULL,
  verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by_label TEXT,
  status payment_status NOT NULL DEFAULT 'not_paid',
  payment_method TEXT,
  payment_notes TEXT,
  mobile_money_ref TEXT,
  proof_url TEXT,
  invoice_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE timetable_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  age_group TEXT NOT NULL,
  age_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  kind session_kind NOT NULL DEFAULT 'training',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location_name TEXT NOT NULL,
  kit_requirements TEXT NOT NULL DEFAULT '',
  trainer_name TEXT NOT NULL DEFAULT '',
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_objectives TEXT NOT NULL DEFAULT '',
  equipment_notes TEXT NOT NULL DEFAULT '',
  instructor_notes TEXT NOT NULL DEFAULT '',
  is_updated BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_session_window CHECK (ends_at > starts_at)
);

CREATE TABLE performance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  happened_on DATE NOT NULL,
  notes TEXT NOT NULL,
  focus_area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel message_channel NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  age_group TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT NOT NULL
);

CREATE TABLE site_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_config_singleton CHECK (id = 1)
);

INSERT INTO site_config (id, content) VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_players_parent ON players(parent_id);
CREATE UNIQUE INDEX uq_players_parent_name_dob ON players (parent_id, lower(player_name), date_of_birth);
CREATE INDEX idx_players_age_group ON players(age_group);
CREATE INDEX idx_players_registration_status ON players(registration_status);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_payments_player ON payments(player_id);
CREATE UNIQUE INDEX uq_payments_player_period_open
  ON payments (player_id, lower(payment_for), date_trunc('month', due_date::timestamp))
  WHERE status <> 'paid';
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_sessions_age_group ON timetable_sessions(age_group);
CREATE INDEX idx_sessions_starts ON timetable_sessions(starts_at);
CREATE INDEX idx_performance_player ON performance_entries(player_id);
CREATE INDEX idx_messages_created ON admin_messages(created_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE site_config IS 'Singleton row id=1: full SiteContent JSON for CMS public pages.';
COMMENT ON TABLE payments IS 'verified_by_label stores admin email or id string when no users row exists.';

COMMIT;
