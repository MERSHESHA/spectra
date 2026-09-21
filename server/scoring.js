import "./loadEnv.js";

/**
 * Server-side scoring — never trust client-sent scores.
 * question_score = round((passed / total) * marks)
 */

export function computeQuestionScore(passed, total, marks) {
  const t = Number(total) || 0;
  const p = Math.max(0, Math.min(Number(passed) || 0, t));
  const m = Number(marks) || 0;
  if (t <= 0) return 0;
  return Math.round((p / t) * m * 100) / 100;
}

export function deriveSubmissionStatus(execution) {
  if (!execution) return "submitted";
  if (execution.status === "compile_error") return "compile_error";

  const results = execution.results || [];
  if (results.some((r) => r.status === "timeout")) return "timeout";
  if (results.some((r) => r.status === "runtime_error" || r.status === "error")) {
    return "runtime_error";
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const total = results.length;
  if (total > 0 && passed === total) return "success";
  if (total > 0) return "failed";
  return "submitted";
}

export function getExamDurationMs() {
  return (Number(process.env.EXAM_DURATION_MINUTES) || 60) * 60 * 1000;
}

/** @deprecated use getExamDurationMs() */
export const EXAM_DURATION_MS = getExamDurationMs();

export const LEVEL_QUESTION_COUNTS = { 1: 3, 2: 2, 3: 1 };
