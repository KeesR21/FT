-- Versioned weekly schedule (immutable after publish; updates = new version).

CREATE TABLE IF NOT EXISTS schedule_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_weeks_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1)
);

CREATE TYPE schedule_version_status AS ENUM ('draft', 'active', 'superseded');

CREATE TABLE IF NOT EXISTS schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status schedule_version_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_id, version_number)
);

CREATE TYPE schedule_period AS ENUM ('morning', 'afternoon');

CREATE TABLE IF NOT EXISTS schedule_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  age_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  coach_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  pitch_id UUID NOT NULL REFERENCES schedule_pitches(id),
  period schedule_period NOT NULL,
  training_topic TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  kit TEXT NOT NULL DEFAULT '',
  CONSTRAINT schedule_sessions_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_versions_week ON schedule_versions(week_id);
CREATE INDEX IF NOT EXISTS idx_schedule_sessions_version ON schedule_sessions(version_id);
CREATE INDEX IF NOT EXISTS idx_schedule_sessions_starts ON schedule_sessions(starts_at);
