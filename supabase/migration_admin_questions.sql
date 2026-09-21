-- Admin question management extensions + performance indexes
-- Run in Supabase SQL Editor after schema.sql / seed.sql

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS examples JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS starter_code JSONB DEFAULT '{}'::jsonb;

-- Ensure sort_order exists on test_cases (already in schema)
CREATE INDEX IF NOT EXISTS idx_questions_level_number
  ON questions (level, question_number);

CREATE INDEX IF NOT EXISTS idx_test_cases_question_hidden
  ON test_cases (question_id, is_hidden);

CREATE INDEX IF NOT EXISTS idx_students_register_number
  ON students (register_number);

CREATE INDEX IF NOT EXISTS idx_students_status
  ON students (status);

CREATE INDEX IF NOT EXISTS idx_submissions_student_question
  ON submissions (student_id, question_id);

CREATE INDEX IF NOT EXISTS idx_results_leaderboard
  ON results (total_score DESC, completion_time_seconds ASC NULLS LAST, completed_at ASC NULLS LAST);
