-- Structured registration intake (nationality, emergency contacts, etc.) for admin review.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS registration_profile JSONB NOT NULL DEFAULT '{}'::jsonb;
