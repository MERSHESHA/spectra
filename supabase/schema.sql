-- SPECTRA Coding Challenge — Supabase schema
-- Run this in the Supabase SQL Editor (or via CLI migration).

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  exam_started_at TIMESTAMPTZ,
  exam_ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'time_expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  question_number INT NOT NULL CHECK (question_number >= 1),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  input_format TEXT,
  output_format TEXT,
  constraints TEXT,
  marks NUMERIC(6, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level, question_number)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  input TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  language TEXT NOT NULL,
  source_code TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('success', 'failed', 'compile_error', 'runtime_error', 'timeout', 'submitted')),
  score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  passed_test_cases INT NOT NULL DEFAULT 0,
  total_test_cases INT NOT NULL DEFAULT 0,
  execution_time NUMERIC(10, 3),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_question_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, question_id)
);

CREATE TABLE IF NOT EXISTS student_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  unlocked BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, level)
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  level1_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  level2_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  level3_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  total_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  completion_time_seconds INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES (100 concurrent students / admin leaderboard)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_register_number ON students (register_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON students (status);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question_id ON submissions (question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_level ON submissions (level);
CREATE INDEX IF NOT EXISTS idx_submissions_student_question ON submissions (student_id, question_id);

CREATE INDEX IF NOT EXISTS idx_sqs_student_id ON student_question_status (student_id);
CREATE INDEX IF NOT EXISTS idx_sqs_question_id ON student_question_status (question_id);

CREATE INDEX IF NOT EXISTS idx_student_levels_student_id ON student_levels (student_id);

CREATE INDEX IF NOT EXISTS idx_results_student_id ON results (student_id);
CREATE INDEX IF NOT EXISTS idx_results_total_score ON results (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_results_completion_time ON results (completion_time_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_results_leaderboard
  ON results (total_score DESC, completion_time_seconds ASC NULLS LAST, completed_at ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_test_cases_question_id ON test_cases (question_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- All privileged access goes through the backend with the
-- service-role key. Anon clients get no direct table access.

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_question_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Deny all for anon/authenticated by default (no policies = no access
-- when RLS is on, except service_role which bypasses RLS).

-- Optional: allow public read of non-sensitive question metadata only
-- (no marks). Uncomment if you want the anon client to fetch questions.
-- CREATE POLICY questions_public_read ON questions
--   FOR SELECT TO anon
--   USING (true);
-- Note: marks would still be visible unless a view strips them.
-- Prefer serving question text via the backend without marks.

-- ============================================================
-- HELPER: recompute results for a student (server-side scoring)
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_student_results(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_l1 NUMERIC(6,2);
  v_l2 NUMERIC(6,2);
  v_l3 NUMERIC(6,2);
  v_total NUMERIC(6,2);
  v_started TIMESTAMPTZ;
  v_ended TIMESTAMPTZ;
  v_seconds INT;
BEGIN
  SELECT COALESCE(SUM(score), 0) INTO v_l1
  FROM student_question_status WHERE student_id = p_student_id AND level = 1 AND is_submitted;

  SELECT COALESCE(SUM(score), 0) INTO v_l2
  FROM student_question_status WHERE student_id = p_student_id AND level = 2 AND is_submitted;

  SELECT COALESCE(SUM(score), 0) INTO v_l3
  FROM student_question_status WHERE student_id = p_student_id AND level = 3 AND is_submitted;

  v_total := v_l1 + v_l2 + v_l3;

  SELECT exam_started_at, exam_ended_at INTO v_started, v_ended
  FROM students WHERE id = p_student_id;

  IF v_started IS NOT NULL AND v_ended IS NOT NULL THEN
    v_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_ended - v_started))::INT);
  ELSE
    v_seconds := NULL;
  END IF;

  INSERT INTO results (
    student_id, level1_score, level2_score, level3_score,
    total_score, completion_time_seconds, completed_at
  ) VALUES (
    p_student_id, v_l1, v_l2, v_l3, v_total, v_seconds, v_ended
  )
  ON CONFLICT (student_id) DO UPDATE SET
    level1_score = EXCLUDED.level1_score,
    level2_score = EXCLUDED.level2_score,
    level3_score = EXCLUDED.level3_score,
    total_score = EXCLUDED.total_score,
    completion_time_seconds = EXCLUDED.completion_time_seconds,
    completed_at = EXCLUDED.completed_at;
END;
$$;
