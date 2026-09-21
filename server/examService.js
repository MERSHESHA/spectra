import { requireDb } from "./db.js";
import { signStudentToken } from "./auth.js";
import {
  computeQuestionScore,
  deriveSubmissionStatus,
  getExamDurationMs,
  LEVEL_QUESTION_COUNTS,
} from "./scoring.js";
import { runAgainstTestCases } from "./execute.js";

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function mapDbError(error, fallbackMessage = "Database request failed.") {
  if (!error) return httpError(500, fallbackMessage);
  if (
    error.code === "PGRST205" ||
    /Could not find the table/i.test(error.message || "")
  ) {
    return httpError(
      503,
      "Database tables are missing. Run supabase/schema.sql and supabase/seed.sql in the Supabase SQL Editor.",
      "SCHEMA_MISSING"
    );
  }
  console.error("[db]", error.message || error);
  return httpError(500, fallbackMessage, error.code || "DB_ERROR");
}


function toMs(iso) {
  return iso ? new Date(iso).getTime() : null;
}

async function loadQuestionStatuses(db, studentId) {
  const { data, error } = await db
    .from("student_question_status")
    .select("question_id, is_submitted, submitted_at, level")
    .eq("student_id", studentId);

  if (error) throw mapDbError(error);

  /** Student-safe map — no scores */
  const submissions = {};
  for (const row of data || []) {
    submissions[row.question_id] = {
      state: row.is_submitted ? "SUBMITTED" : "NOT_STARTED",
      submittedAt: row.submitted_at
        ? new Date(row.submitted_at).getTime()
        : null,
      language: null,
    };
  }
  return submissions;
}

async function computeUnlockedLevel(db, studentId) {
  const { data, error } = await db
    .from("student_question_status")
    .select("question_id, level, is_submitted")
    .eq("student_id", studentId);

  if (error) throw mapDbError(error);

  const byLevel = { 1: [], 2: [], 3: [] };
  for (const row of data || []) {
    byLevel[row.level]?.push(row);
  }

  for (const level of [1, 2, 3]) {
    const expected = LEVEL_QUESTION_COUNTS[level];
    const rows = byLevel[level] || [];
    const submitted = rows.filter((r) => r.is_submitted).length;
    // Also verify against questions table count if status rows incomplete
    if (submitted < expected) return level;
  }
  return 3;
}

async function isLevelFullySubmitted(db, studentId, level) {
  const expected = LEVEL_QUESTION_COUNTS[level];
  const { data, error } = await db
    .from("student_question_status")
    .select("is_submitted")
    .eq("student_id", studentId)
    .eq("level", level);

  if (error) throw mapDbError(error);
  const submitted = (data || []).filter((r) => r.is_submitted).length;
  return submitted >= expected;
}

async function ensureExamNotExpired(db, student) {
  if (!student.exam_started_at) return student;

  const endsAt = new Date(student.exam_started_at).getTime() + getExamDurationMs();
  if (Date.now() < endsAt) return student;

  if (student.status === "in_progress") {
    const endedAt = new Date(endsAt).toISOString();
    const { data, error } = await db
      .from("students")
      .update({ status: "time_expired", exam_ended_at: endedAt })
      .eq("id", student.id)
      .select("*")
      .single();
    if (error) throw mapDbError(error);
    await db.rpc("recompute_student_results", { p_student_id: student.id });
    return data;
  }
  return student;
}

function buildExamState(student, submissions, unlockedLevel, token) {
  const startedAt = toMs(student.exam_started_at);
  const endsAt = startedAt ? startedAt + getExamDurationMs() : null;
  const timedOut =
    student.status === "time_expired" ||
    (endsAt != null && Date.now() >= endsAt);
  const examComplete = student.status === "completed";

  return {
    examId: student.id,
    studentId: student.id,
    token,
    startedAt,
    endsAt,
    submissions,
    unlockedLevel,
    examComplete,
    timedOut,
    status: student.status,
    participant: {
      registerNumber: student.register_number,
      name: student.name,
      department: student.department,
      year: student.year,
    },
  };
}

export async function startExam(participant) {
  const db = requireDb();
  const {
    registerNumber,
    name,
    department,
    year,
  } = participant || {};

  if (!/^\d{12}$/.test(registerNumber || "")) {
    throw httpError(400, "Invalid register number.", "INVALID_REGISTER");
  }
  if (!name?.trim() || !department || !year) {
    throw httpError(400, "Missing participant fields.", "INVALID_PARTICIPANT");
  }

  // Resume existing exam for same register number (no duplicate rows)
  const { data: existing, error: findErr } = await db
    .from("students")
    .select("*")
    .eq("register_number", registerNumber)
    .maybeSingle();

  if (findErr) throw mapDbError(findErr);

  let student = existing;

  if (!student) {
    const nowIso = new Date().toISOString();
    const { data: created, error: createErr } = await db
      .from("students")
      .insert({
        register_number: registerNumber,
        name: name.trim(),
        department,
        year: String(year),
        exam_started_at: nowIso,
        status: "in_progress",
      })
      .select("*")
      .single();

    if (createErr) throw mapDbError(createErr);
    student = created;

    // Init level unlocks: level 1 unlocked
    await db.from("student_levels").insert([
      { student_id: student.id, level: 1, unlocked: true, completed: false },
      { student_id: student.id, level: 2, unlocked: false, completed: false },
      { student_id: student.id, level: 3, unlocked: false, completed: false },
    ]);

    // Init question status rows from questions table
    const { data: questions, error: qErr } = await db
      .from("questions")
      .select("id, level");
    if (qErr) throw mapDbError(qErr);

    if (questions?.length) {
      await db.from("student_question_status").insert(
        questions.map((q) => ({
          student_id: student.id,
          question_id: q.id,
          level: q.level,
          is_submitted: false,
          score: 0,
        }))
      );
    }

    // Placeholder results row
    await db.from("results").insert({ student_id: student.id });
  } else {
    student = await ensureExamNotExpired(db, student);

    // If never started (edge), start now
    if (!student.exam_started_at && student.status === "not_started") {
      const nowIso = new Date().toISOString();
      const { data: updated, error } = await db
        .from("students")
        .update({
          name: name.trim(),
          department,
          year: String(year),
          exam_started_at: nowIso,
          status: "in_progress",
        })
        .eq("id", student.id)
        .select("*")
        .single();
      if (error) throw mapDbError(error);
      student = updated;
    }
  }

  const token = signStudentToken({
    studentId: student.id,
    registerNumber: student.register_number,
  });

  const submissions = await loadQuestionStatuses(db, student.id);
  const unlockedLevel = await computeUnlockedLevel(db, student.id);

  return buildExamState(student, submissions, unlockedLevel, token);
}

export async function getExamState(studentAuth) {
  const db = requireDb();
  const { data: student, error } = await db
    .from("students")
    .select("*")
    .eq("id", studentAuth.studentId)
    .single();

  if (error || !student) throw httpError(404, "Student not found.");

  const refreshed = await ensureExamNotExpired(db, student);
  const submissions = await loadQuestionStatuses(db, refreshed.id);
  const unlockedLevel = await computeUnlockedLevel(db, refreshed.id);
  const token = signStudentToken({
    studentId: refreshed.id,
    registerNumber: refreshed.register_number,
  });

  return buildExamState(refreshed, submissions, unlockedLevel, token);
}

async function loadTestCases(db, questionId) {
  const { data, error } = await db
    .from("test_cases")
    .select("id, input, expected_output, sort_order")
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true });

  if (error) throw mapDbError(error);
  return data || [];
}

export async function runCode(studentAuth, { questionId, language, code }) {
  const db = requireDb();

  if (!code?.trim()) throw httpError(400, "Code cannot be empty.", "EMPTY_CODE");
  if (!["python", "c", "java"].includes(language)) {
    throw httpError(400, "Unsupported language.", "BAD_LANGUAGE");
  }

  const { data: student, error: sErr } = await db
    .from("students")
    .select("*")
    .eq("id", studentAuth.studentId)
    .single();
  if (sErr || !student) throw httpError(404, "Student not found.");

  const refreshed = await ensureExamNotExpired(db, student);
  if (refreshed.status === "time_expired" || refreshed.status === "completed") {
    throw httpError(403, "Exam has ended.", "EXAM_ENDED");
  }

  const endsAt =
    new Date(refreshed.exam_started_at).getTime() + getExamDurationMs();
  if (Date.now() >= endsAt) {
    throw httpError(403, "Exam has ended.", "EXAM_ENDED");
  }

  const { data: question, error: qErr } = await db
    .from("questions")
    .select("id, level")
    .eq("id", questionId)
    .single();
  if (qErr || !question) throw httpError(404, "Question not found.");

  const unlocked = await computeUnlockedLevel(db, refreshed.id);
  if (question.level > unlocked) {
    throw httpError(403, "Level is locked.", "LEVEL_LOCKED");
  }

  const testCases = await loadTestCases(db, questionId);
  if (!testCases.length) {
    throw httpError(400, "No test cases configured.", "NO_TEST_CASES");
  }

  // Map to sequential display ids 1..n (student never sees DB uuids needed)
  const mapped = testCases.map((tc, i) => ({
    id: i + 1,
    input: tc.input,
    expected_output: tc.expected_output,
  }));

  const execution = await runAgainstTestCases({
    language,
    code,
    testCases: mapped,
  });

  // Student-safe response — no scores / marks
  return {
    status: execution.status,
    message: execution.message || null,
    results: (execution.results || []).map((r) => ({
      id: r.id,
      status: r.status,
      error: r.error || null,
    })),
    passed_test_cases: execution.passed_test_cases,
    total_test_cases: execution.total_test_cases,
    execution_time: execution.execution_time,
  };
}

export async function submitAnswer(
  studentAuth,
  { questionId, language, code }
) {
  const db = requireDb();

  if (!code?.trim()) {
    return { ok: false, error: "EMPTY_CODE" };
  }
  if (!["python", "c", "java"].includes(language)) {
    return { ok: false, error: "BAD_LANGUAGE" };
  }

  const { data: student, error: sErr } = await db
    .from("students")
    .select("*")
    .eq("id", studentAuth.studentId)
    .single();
  if (sErr || !student) return { ok: false, error: "NO_SESSION" };

  let refreshed = await ensureExamNotExpired(db, student);
  if (refreshed.status === "time_expired") {
    return { ok: false, error: "EXAM_ENDED" };
  }
  if (refreshed.status === "completed") {
    return { ok: false, error: "EXAM_ENDED" };
  }

  const endsAt =
    new Date(refreshed.exam_started_at).getTime() + getExamDurationMs();
  if (Date.now() >= endsAt) {
    await ensureExamNotExpired(db, refreshed);
    return { ok: false, error: "EXAM_ENDED" };
  }

  const { data: question, error: qErr } = await db
    .from("questions")
    .select("id, level, marks")
    .eq("id", questionId)
    .single();
  if (qErr || !question) return { ok: false, error: "UNKNOWN_QUESTION" };

  const unlocked = await computeUnlockedLevel(db, refreshed.id);
  if (question.level > unlocked) {
    return { ok: false, error: "LEVEL_LOCKED" };
  }

  const { data: statusRow } = await db
    .from("student_question_status")
    .select("*")
    .eq("student_id", refreshed.id)
    .eq("question_id", questionId)
    .maybeSingle();

  if (statusRow?.is_submitted) {
    const unlockedLevel = await computeUnlockedLevel(db, refreshed.id);
    const examComplete = refreshed.status === "completed";
    return {
      ok: true,
      alreadySubmitted: true,
      questionId,
      unlockedLevel,
      examComplete,
      levelJustUnlocked: null,
    };
  }

  // Authoritative re-execution on server (do not trust client results)
  const testCases = await loadTestCases(db, questionId);
  const mapped = testCases.map((tc, i) => ({
    id: i + 1,
    input: tc.input,
    expected_output: tc.expected_output,
  }));

  const execution = await runAgainstTestCases({
    language,
    code,
    testCases: mapped.length
      ? mapped
      : [{ id: 1, input: "", expected_output: "" }],
  });

  const passed = execution.passed_test_cases || 0;
  const total = execution.total_test_cases || mapped.length || 0;
  const score = computeQuestionScore(passed, total, question.marks);
  const status = deriveSubmissionStatus(execution);
  const submittedAt = new Date().toISOString();

  const { error: subErr } = await db.from("submissions").insert({
    student_id: refreshed.id,
    question_id: questionId,
    level: question.level,
    language,
    source_code: code,
    status,
    score,
    passed_test_cases: passed,
    total_test_cases: total,
    execution_time: execution.execution_time ?? null,
    submitted_at: submittedAt,
  });
  if (subErr) throw mapDbError(subErr);

  const { error: stErr } = await db
    .from("student_question_status")
    .upsert(
      {
        student_id: refreshed.id,
        question_id: questionId,
        level: question.level,
        is_submitted: true,
        score,
        submitted_at: submittedAt,
      },
      { onConflict: "student_id,question_id" }
    );
  if (stErr) throw mapDbError(stErr);

  // Level completion / unlock
  let levelJustUnlocked = null;
  const levelDone = await isLevelFullySubmitted(db, refreshed.id, question.level);

  if (levelDone) {
    await db
      .from("student_levels")
      .update({ completed: true, completed_at: submittedAt })
      .eq("student_id", refreshed.id)
      .eq("level", question.level);

    if (question.level < 3) {
      levelJustUnlocked = question.level + 1;
      await db
        .from("student_levels")
        .update({ unlocked: true })
        .eq("student_id", refreshed.id)
        .eq("level", levelJustUnlocked);
    } else {
      // Exam complete
      const { data: doneStudent, error: doneErr } = await db
        .from("students")
        .update({ status: "completed", exam_ended_at: submittedAt })
        .eq("id", refreshed.id)
        .select("*")
        .single();
      if (doneErr) throw mapDbError(doneErr);
      refreshed = doneStudent;
    }
  }

  await db.rpc("recompute_student_results", { p_student_id: refreshed.id });

  const unlockedLevel = await computeUnlockedLevel(db, refreshed.id);
  const examComplete = refreshed.status === "completed";

  // Never return scores to the student
  return {
    ok: true,
    alreadySubmitted: false,
    questionId,
    unlockedLevel,
    levelJustUnlocked,
    examComplete,
  };
}

const DEFAULT_STARTERS = {
  python: "# Write your solution here\n\n",
  c: "#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n",
  java: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n",
};

/**
 * Student-safe question payload — no marks, no hidden test inputs/outputs.
 */
export async function getStudentQuestions(studentAuth) {
  const db = requireDb();

  const { data: student, error: sErr } = await db
    .from("students")
    .select("id, status")
    .eq("id", studentAuth.studentId)
    .single();
  if (sErr || !student) throw httpError(404, "Student not found.");

  const { data: questions, error } = await db
    .from("questions")
    .select(
      "id, level, question_number, title, description, input_format, output_format, constraints, examples, starter_code"
    )
    .order("level", { ascending: true })
    .order("question_number", { ascending: true });
  if (error) throw mapDbError(error);

  const levels = { 1: [], 2: [], 3: [] };
  for (const q of questions || []) {
    const starter = q.starter_code && typeof q.starter_code === "object"
      ? q.starter_code
      : {};
    levels[q.level]?.push({
      id: q.id,
      title: q.title,
      description: q.description,
      inputFormat: q.input_format,
      outputFormat: q.output_format,
      constraints: q.constraints,
      examples: Array.isArray(q.examples) ? q.examples : [],
      starterCode: {
        python: starter.python || DEFAULT_STARTERS.python,
        c: starter.c || DEFAULT_STARTERS.c,
        java: starter.java || DEFAULT_STARTERS.java,
      },
    });
  }

  return { levels };
}

/**
 * Explicit End Test — save state, recompute scores, lock exam.
 * Does not return marks to the student.
 */
export async function endExam(studentAuth) {
  const db = requireDb();

  const { data: student, error: sErr } = await db
    .from("students")
    .select("*")
    .eq("id", studentAuth.studentId)
    .single();
  if (sErr || !student) throw httpError(404, "Student not found.");

  if (student.status === "completed" || student.status === "time_expired") {
    const submissions = await loadQuestionStatuses(db, student.id);
    const unlockedLevel = await computeUnlockedLevel(db, student.id);
    const token = signStudentToken({
      studentId: student.id,
      registerNumber: student.register_number,
    });
    return {
      ok: true,
      alreadyEnded: true,
      ...buildExamState(student, submissions, unlockedLevel, token),
    };
  }

  const endedAt = new Date().toISOString();
  const { data: updated, error } = await db
    .from("students")
    .update({ status: "completed", exam_ended_at: endedAt })
    .eq("id", student.id)
    .select("*")
    .single();
  if (error) throw mapDbError(error);

  await db.rpc("recompute_student_results", { p_student_id: student.id });

  const submissions = await loadQuestionStatuses(db, updated.id);
  const unlockedLevel = await computeUnlockedLevel(db, updated.id);
  const token = signStudentToken({
    studentId: updated.id,
    registerNumber: updated.register_number,
  });

  return {
    ok: true,
    alreadyEnded: false,
    ...buildExamState(updated, submissions, unlockedLevel, token),
  };
}
