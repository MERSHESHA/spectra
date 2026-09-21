/**
 * Compiler / code-execution API client.
 *
 * Isolated so the Coding Page never talks to a sandbox directly.
 * Point VITE_COMPILER_API_URL at your sandboxed backend when ready.
 *
 * Expected backend contract (POST):
 *   Request:  { language, code, testCases: [{ id, input, expectedOutput }] }
 *   Response: {
 *     status: "ok" | "compile_error" | "error",
 *     message?: string,
 *     results?: [{
 *       id, status: "passed"|"failed"|"runtime_error"|"timeout"|"error",
 *       input?, expectedOutput?, actualOutput?, error?
 *     }]
 *   }
 */

const COMPILER_API_URL =
  import.meta.env.VITE_COMPILER_API_URL || "/api/execute";

const LANGUAGE_MAP = {
  python: "python",
  c: "c",
  java: "java",
};

/**
 * Run student code against the question's configured test cases.
 * Does NOT return marks or scores — only per-test-case status.
 *
 * @param {{ language: string, code: string, testCases: Array<{id: number|string, input: string, expectedOutput: string}>, questionId?: string }} params
 */
export async function runCodeAgainstTestCases({
  language,
  code,
  testCases,
  questionId,
}) {
  if (!code?.trim()) {
    throw new Error("Code cannot be empty.");
  }

  if (!LANGUAGE_MAP[language]) {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("No test cases configured for this question.");
  }

  // Strip expectedOutput from being shown later is UI's job;
  // we still send it to the backend for comparison (server-side).
  const payload = {
    language: LANGUAGE_MAP[language],
    code,
    questionId,
    testCases: testCases.map((tc) => ({
      id: tc.id,
      input: tc.input ?? "",
      expectedOutput: tc.expectedOutput ?? "",
    })),
  };

  let response;
  try {
    response = await fetch(COMPILER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Unable to reach the code execution service. Please try again."
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from the code execution service.");
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Execution failed (${response.status}).`
    );
  }

  return normalizeExecutionResult(data, testCases);
}

function normalizeExecutionResult(data, testCases) {
  if (data.status === "compile_error") {
    return {
      status: "compile_error",
      message: data.message || "Compilation failed.",
      results: testCases.map((tc) => ({
        id: tc.id,
        status: "error",
        error: data.message || "Compilation failed.",
      })),
    };
  }

  const results = Array.isArray(data.results)
    ? data.results.map((r) => ({
        id: r.id,
        status: r.status,
        // Never expose expectedOutput to the student UI from this layer
        // for failed cases in a way that reveals marking — UI only shows pass/fail.
        error: r.error || null,
      }))
    : testCases.map((tc) => ({
        id: tc.id,
        status: "error",
        error: data.message || "No result returned.",
      }));

  return {
    status: data.status || "ok",
    message: data.message || null,
    results,
  };
}
