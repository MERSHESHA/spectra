/**
 * Code execution client — results are pass/fail only (no marks).
 * Backend loads test cases from Supabase; client does not send expected output.
 */

import { apiUrl } from "../lib/apiBase";

function getStudentToken() {
  return sessionStorage.getItem("examSessionToken");
}

export async function runCodeAgainstTestCases({
  language,
  code,
  questionId,
}) {
  if (!code?.trim()) throw new Error("Code cannot be empty.");
  if (!questionId) throw new Error("Missing question id.");

  const token = getStudentToken();
  if (!token) {
    throw new Error(
      "Exam session not found. Please re-enter from the landing page."
    );
  }

  let response;
  try {
    response = await fetch(apiUrl("/execute"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language, code, questionId }),
    });
  } catch {
    throw new Error("Unable to connect to server");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from the code execution service.");
  }

  if (!response.ok) {
    throw new Error(data?.message || `Execution failed (${response.status}).`);
  }

  if (data.status === "compile_error") {
    return {
      status: "compile_error",
      message: data.message || "Compilation failed.",
      results: data.results || [],
      passed_test_cases: data.passed_test_cases ?? 0,
      total_test_cases: data.total_test_cases ?? 0,
      execution_time: data.execution_time,
    };
  }

  return {
    status: data.status || "ok",
    message: data.message || null,
    results: (data.results || []).map((r) => ({
      id: r.id,
      status: r.status,
      error: r.error || null,
    })),
    passed_test_cases: data.passed_test_cases,
    total_test_cases: data.total_test_cases,
    execution_time: data.execution_time,
  };
}
