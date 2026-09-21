import { requireDb } from "./db.js";
import { verifyPassword, signAdminToken } from "./auth.js";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function formatTime(seconds) {
  if (seconds == null) return "—";
  const s = Math.max(0, Number(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export async function adminLogin(username, password) {
  const db = requireDb();
  if (!username || !password) {
    throw httpError(400, "Username and password are required.");
  }

  const { data: admin, error } = await db
    .from("admins")
    .select("id, username, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error) throw httpError(500, error.message);
  if (!admin) throw httpError(401, "Invalid credentials.");

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) throw httpError(401, "Invalid credentials.");

  const token = signAdminToken({ adminId: admin.id, username: admin.username });
  return { token, username: admin.username };
}

export async function getOverview() {
  const db = requireDb();
  const { data, error } = await db.from("students").select("status");
  if (error) throw httpError(500, error.message);

  const counts = {
    total: data.length,
    not_started: 0,
    in_progress: 0,
    completed: 0,
    time_expired: 0,
  };
  for (const row of data) {
    if (counts[row.status] != null) counts[row.status] += 1;
  }
  return {
    totalStudents: counts.total,
    notStarted: counts.not_started,
    started: counts.in_progress + counts.completed + counts.time_expired,
    inProgress: counts.in_progress,
    completed: counts.completed,
    timeExpired: counts.time_expired,
  };
}

export async function getLeaderboard() {
  const db = requireDb();

  // Efficient join via two queries (avoids N+1 per student)
  const { data: results, error: rErr } = await db
    .from("results")
    .select(
      "student_id, level1_score, level2_score, level3_score, total_score, completion_time_seconds, completed_at"
    )
    .order("total_score", { ascending: false })
    .order("completion_time_seconds", { ascending: true })
    .order("completed_at", { ascending: true });

  if (rErr) throw httpError(500, rErr.message);

  const { data: students, error: sErr } = await db
    .from("students")
    .select(
      "id, register_number, name, department, year, status, exam_started_at, exam_ended_at"
    );
  if (sErr) throw httpError(500, sErr.message);

  const byId = Object.fromEntries((students || []).map((s) => [s.id, s]));

  // Students without results yet still appear (score 0)
  const resultIds = new Set((results || []).map((r) => r.student_id));
  const merged = [...(results || [])];
  for (const s of students || []) {
    if (!resultIds.has(s.id)) {
      merged.push({
        student_id: s.id,
        level1_score: 0,
        level2_score: 0,
        level3_score: 0,
        total_score: 0,
        completion_time_seconds: null,
        completed_at: null,
      });
    }
  }

  merged.sort((a, b) => {
    const scoreDiff = Number(b.total_score) - Number(a.total_score);
    if (scoreDiff !== 0) return scoreDiff;
    const ta = a.completion_time_seconds;
    const tb = b.completion_time_seconds;
    if (ta == null && tb == null) {
      /* fall through */
    } else if (ta == null) return 1;
    else if (tb == null) return -1;
    else if (ta !== tb) return ta - tb;

    const ca = a.completed_at ? new Date(a.completed_at).getTime() : Infinity;
    const cb = b.completed_at ? new Date(b.completed_at).getTime() : Infinity;
    return ca - cb;
  });

  return merged.map((row, index) => {
    const s = byId[row.student_id] || {};
    return {
      rank: index + 1,
      studentId: row.student_id,
      registerNumber: s.register_number,
      name: s.name,
      department: s.department,
      year: s.year,
      level1: Number(row.level1_score) || 0,
      level2: Number(row.level2_score) || 0,
      level3: Number(row.level3_score) || 0,
      totalScore: Number(row.total_score) || 0,
      completionTimeSeconds: row.completion_time_seconds,
      completionTime: formatTime(row.completion_time_seconds),
      status: s.status || "not_started",
      completedAt: row.completed_at,
    };
  });
}

export async function getStudentDetail(studentId) {
  const db = requireDb();

  const { data: student, error: sErr } = await db
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();
  if (sErr || !student) throw httpError(404, "Student not found.");

  const { data: result } = await db
    .from("results")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  const { data: questions } = await db
    .from("questions")
    .select("id, level, question_number, title, marks")
    .order("level")
    .order("question_number");

  const { data: statuses } = await db
    .from("student_question_status")
    .select("*")
    .eq("student_id", studentId);

  const { data: submissions } = await db
    .from("submissions")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });

  const statusByQ = Object.fromEntries(
    (statuses || []).map((r) => [r.question_id, r])
  );

  // Latest submission per question
  const latestSub = {};
  for (const sub of submissions || []) {
    if (!latestSub[sub.question_id]) latestSub[sub.question_id] = sub;
  }

  const byLevel = { 1: [], 2: [], 3: [] };
  for (const q of questions || []) {
    const st = statusByQ[q.id];
    const sub = latestSub[q.id];
    byLevel[q.level].push({
      questionId: q.id,
      questionNumber: q.question_number,
      title: q.title,
      marks: Number(q.marks),
      isSubmitted: Boolean(st?.is_submitted),
      score: Number(st?.score || 0),
      language: sub?.language || null,
      passedTestCases: sub?.passed_test_cases ?? null,
      totalTestCases: sub?.total_test_cases ?? null,
      status: sub?.status || null,
      submittedAt: st?.submitted_at || sub?.submitted_at || null,
      executionTime: sub?.execution_time ?? null,
    });
  }

  return {
    student: {
      id: student.id,
      registerNumber: student.register_number,
      name: student.name,
      department: student.department,
      year: student.year,
      status: student.status,
      examStartedAt: student.exam_started_at,
      examEndedAt: student.exam_ended_at,
    },
    result: result
      ? {
          level1Score: Number(result.level1_score) || 0,
          level2Score: Number(result.level2_score) || 0,
          level3Score: Number(result.level3_score) || 0,
          totalScore: Number(result.total_score) || 0,
          completionTimeSeconds: result.completion_time_seconds,
          completionTime: formatTime(result.completion_time_seconds),
          completedAt: result.completed_at,
        }
      : null,
    levels: byLevel,
  };
}

export function getEvaluationCriteria() {
  return {
    levels: [
      {
        level: 1,
        questionCount: 3,
        totalMarks: 30,
        questions: [
          { number: 1, marks: 10 },
          { number: 2, marks: 10 },
          { number: 3, marks: 10 },
        ],
      },
      {
        level: 2,
        questionCount: 2,
        totalMarks: 30,
        questions: [
          { number: 1, marks: 15 },
          { number: 2, marks: 15 },
        ],
      },
      {
        level: 3,
        questionCount: 1,
        totalMarks: 40,
        questions: [{ number: 1, marks: 40 }],
      },
    ],
    totalMarks: 100,
    scoringFormula:
      "question_score = round((passed_test_cases / total_test_cases) × question_marks)",
    ranking: [
      "Total Score — descending",
      "Completion Time — ascending",
      "Completed At — ascending (final tie-breaker)",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Question + test case management (admin)                            */
/* ------------------------------------------------------------------ */

export async function listQuestions() {
  const db = requireDb();
  const { data: questions, error } = await db
    .from("questions")
    .select("*")
    .order("level", { ascending: true })
    .order("question_number", { ascending: true });
  if (error) throw httpError(500, error.message);

  const { data: cases, error: cErr } = await db
    .from("test_cases")
    .select("id, question_id, input, expected_output, is_hidden, sort_order")
    .order("sort_order", { ascending: true });
  if (cErr) throw httpError(500, cErr.message);

  const byQ = {};
  for (const tc of cases || []) {
    if (!byQ[tc.question_id]) byQ[tc.question_id] = [];
    byQ[tc.question_id].push(tc);
  }

  return (questions || []).map((q) => ({
    ...q,
    marks: Number(q.marks),
    testCases: byQ[q.id] || [],
  }));
}

export async function upsertQuestion(payload) {
  const db = requireDb();
  const id =
    payload.id ||
    `level${payload.level}-q${payload.question_number}-${Date.now()}`;

  const row = {
    id,
    level: Number(payload.level),
    question_number: Number(payload.question_number),
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    input_format: payload.input_format ?? payload.inputFormat ?? null,
    output_format: payload.output_format ?? payload.outputFormat ?? null,
    constraints: payload.constraints ?? null,
    marks: Number(payload.marks) || 0,
    examples: payload.examples ?? [],
    starter_code: payload.starter_code ?? payload.starterCode ?? {},
  };

  if (![1, 2, 3].includes(row.level)) {
    throw httpError(400, "Level must be 1, 2, or 3.");
  }
  if (!row.title || !row.description) {
    throw httpError(400, "Title and description are required.");
  }

  const { data, error } = await db
    .from("questions")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    // Columns examples/starter_code require migration_admin_questions.sql
    if (/examples|starter_code/i.test(error.message || "")) {
      delete row.examples;
      delete row.starter_code;
      const retry = await db
        .from("questions")
        .upsert(row, { onConflict: "id" })
        .select("*")
        .single();
      if (retry.error) throw httpError(500, retry.error.message);
      return retry.data;
    }
    throw httpError(500, error.message);
  }
  return data;
}

export async function deleteQuestion(questionId) {
  const db = requireDb();
  const { error } = await db.from("questions").delete().eq("id", questionId);
  if (error) throw httpError(500, error.message);
  return { ok: true };
}

export async function upsertTestCase(payload) {
  const db = requireDb();
  const row = {
    question_id: payload.question_id || payload.questionId,
    input: payload.input ?? "",
    expected_output: payload.expected_output ?? payload.expectedOutput ?? "",
    is_hidden: Boolean(payload.is_hidden ?? payload.isHidden),
    sort_order: Number(payload.sort_order ?? payload.sortOrder ?? 0),
  };
  if (!row.question_id) throw httpError(400, "question_id is required.");

  if (payload.id) {
    const { data, error } = await db
      .from("test_cases")
      .update(row)
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error) throw httpError(500, error.message);
    return data;
  }

  const { data, error } = await db
    .from("test_cases")
    .insert(row)
    .select("*")
    .single();
  if (error) throw httpError(500, error.message);
  return data;
}

export async function deleteTestCase(testCaseId) {
  const db = requireDb();
  const { error } = await db.from("test_cases").delete().eq("id", testCaseId);
  if (error) throw httpError(500, error.message);
  return { ok: true };
}

