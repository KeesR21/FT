-- Enriched timetable sessions: squads, trainer, activities, objectives.
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS age_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS trainer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS activities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS session_objectives TEXT NOT NULL DEFAULT '';
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS equipment_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE timetable_sessions ADD COLUMN IF NOT EXISTS instructor_notes TEXT NOT NULL DEFAULT '';

UPDATE timetable_sessions
SET age_groups = jsonb_build_array(age_group)
WHERE age_groups = '[]'::jsonb OR age_groups IS NULL;
