/**
 * Code execution engine — C / Java / Python.
 *
 * Providers:
 *   - onlinecompiler  (production on Vercel — OnlineCompiler.io sync REST API)
 *   - local           (dev machine with python/gcc/javac installed)
 *
 * Controlled concurrency so many students queue instead of crashing the app.
 * Never runs student code inside the Node process itself.
 * Never exposes provider API keys to the browser.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const RUN_TIMEOUT_MS = Number(process.env.EXEC_RUN_TIMEOUT_MS) || 5000;
const COMPILE_TIMEOUT_MS = Number(process.env.EXEC_COMPILE_TIMEOUT_MS) || 10000;
/** OnlineCompiler.io free sync concurrency is 4; default matches that. */
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_EXECUTIONS) || 4
);

/* ------------------------------------------------------------------ */
/* Output comparison                                                  */
/* ------------------------------------------------------------------ */

/**
 * Normalize for fair compare:
 * - CRLF → LF
 * - strip trailing spaces/tabs on each line
 * - strip trailing blank lines / final newline differences
 * - keep meaningful interior spaces
 */
export function normalizeOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export function outputsMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/* ------------------------------------------------------------------ */
/* Concurrency queue                                                  */
/* ------------------------------------------------------------------ */

let active = 0;
const waitQueue = [];

function acquireSlot() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(resolve);
  }).then(() => {
    active += 1;
  });
}

function releaseSlot() {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) next();
}

async function withConcurrency(fn) {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

/* ------------------------------------------------------------------ */
/* Local process helpers                                              */
/* ------------------------------------------------------------------ */

function runProcess(command, args, { cwd, stdin = "", timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: env || {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        LANG: "C.UTF-8",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      resolve({
        ok: false,
        timeout: true,
        code: null,
        stdout,
        stderr,
        error: "Time limit exceeded.",
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 512_000) stdout = stdout.slice(0, 512_000);
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 256_000) stderr = stderr.slice(0, 256_000);
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr,
        error: err.message || "Failed to start process.",
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        error:
          code === 0
            ? null
            : normalizeOutput(stderr) || `Exit code ${code}`,
      });
    });

    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function whichCommand(candidates) {
  for (const cmd of candidates) {
    const result = await runProcess(cmd, ["--version"], {
      cwd: os.tmpdir(),
      timeoutMs: 3000,
    });
    if (
      result.error &&
      /ENOENT|not recognized|Failed to start/i.test(result.error)
    ) {
      continue;
    }
    if (result.code !== null || result.stdout || result.stderr) return cmd;
  }
  return null;
}

let toolCache = null;

async function resolveTools() {
  if (toolCache) return toolCache;
  toolCache = {
    python: await whichCommand(["python3", "python", "py"]),
    gcc: await whichCommand(["gcc"]),
    javac: await whichCommand(["javac"]),
    java: await whichCommand(["java"]),
  };
  return toolCache;
}

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), `spectra-exec-${randomUUID()}-`)
  );
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executePythonLocal(code, stdin, tools) {
  if (!tools.python) {
    return {
      ok: false,
      error: "Python is not available in this execution environment.",
    };
  }
  return withTempDir(async (dir) => {
    const file = path.join(dir, "main.py");
    await fs.writeFile(file, code, "utf8");
    const result = await runProcess(tools.python, [file], {
      cwd: dir,
      stdin,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    if (result.timeout) {
      return { ok: false, timeout: true, error: "Time limit exceeded." };
    }
    if (!result.ok) {
      return {
        ok: false,
        runtimeError: true,
        error: normalizeOutput(result.stderr) || result.error || "Runtime error.",
        output: normalizeOutput(result.stdout),
      };
    }
    return { ok: true, output: normalizeOutput(result.stdout) };
  });
}

async function executeCLocal(code, stdin, tools) {
  if (!tools.gcc) {
    return {
      ok: false,
      compileError: true,
      error: "GCC is not available in this execution environment.",
    };
  }
  return withTempDir(async (dir) => {
    const source = path.join(dir, "Main.c");
    const binary = path.join(
      dir,
      process.platform === "win32" ? "Main.exe" : "Main"
    );
    await fs.writeFile(source, code, "utf8");
    const compile = await runProcess(
      tools.gcc,
      [source, "-O2", "-std=c11", "-o", binary],
      { cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS }
    );
    if (compile.timeout) {
      return { ok: false, timeout: true, error: "Compilation timed out." };
    }
    if (!compile.ok) {
      return {
        ok: false,
        compileError: true,
        error: normalizeOutput(compile.stderr) || "Compilation failed.",
      };
    }
    const result = await runProcess(binary, [], {
      cwd: dir,
      stdin,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    if (result.timeout) {
      return { ok: false, timeout: true, error: "Time limit exceeded." };
    }
    if (!result.ok) {
      return {
        ok: false,
        runtimeError: true,
        error: normalizeOutput(result.stderr) || result.error || "Runtime error.",
        output: normalizeOutput(result.stdout),
      };
    }
    return { ok: true, output: normalizeOutput(result.stdout) };
  });
}

async function executeJavaLocal(code, stdin, tools) {
  if (!tools.javac || !tools.java) {
    return {
      ok: false,
      compileError: true,
      error: "Java JDK is not available in this execution environment.",
    };
  }
  return withTempDir(async (dir) => {
    // Ensure public class Main for competitive-programming style
    let sourceCode = code;
    if (!/public\s+class\s+Main\b/.test(code) && /public\s+class\s+(\w+)/.test(code)) {
      // Keep as-is if different public class — javac requires matching filename;
      // we still write Main.java so prefer Main.
      sourceCode = code.replace(/public\s+class\s+\w+/, "public class Main");
    }
    await fs.writeFile(path.join(dir, "Main.java"), sourceCode, "utf8");
    const compile = await runProcess(tools.javac, ["Main.java"], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.timeout) {
      return { ok: false, timeout: true, error: "Compilation timed out." };
    }
    if (!compile.ok) {
      return {
        ok: false,
        compileError: true,
        error: normalizeOutput(compile.stderr) || "Compilation failed.",
      };
    }
    const result = await runProcess(tools.java, ["Main"], {
      cwd: dir,
      stdin,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    if (result.timeout) {
      return { ok: false, timeout: true, error: "Time limit exceeded." };
    }
    if (!result.ok) {
      return {
        ok: false,
        runtimeError: true,
        error: normalizeOutput(result.stderr) || result.error || "Runtime error.",
        output: normalizeOutput(result.stdout),
      };
    }
    return { ok: true, output: normalizeOutput(result.stdout) };
  });
}

async function runOnceLocal(language, code, stdin, tools) {
  if (language === "python") return executePythonLocal(code, stdin, tools);
  if (language === "c") return executeCLocal(code, stdin, tools);
  if (language === "java") return executeJavaLocal(code, stdin, tools);
  return { ok: false, error: `Unsupported language: ${language}` };
}

/* ------------------------------------------------------------------ */
/* OnlineCompiler.io remote provider (free sync REST API)             */
/* ------------------------------------------------------------------ */

const ONLINECOMPILER_COMPILERS = {
  python: process.env.ONLINECOMPILER_COMPILER_PYTHON || "python-3.14",
  c: process.env.ONLINECOMPILER_COMPILER_C || "gcc-15",
  java: process.env.ONLINECOMPILER_COMPILER_JAVA || "openjdk-25",
};

function onlineCompilerConfigured() {
  return Boolean(String(process.env.ONLINECOMPILER_API_KEY || "").trim());
}

function onlineCompilerBase() {
  return (
    process.env.ONLINECOMPILER_API_URL || "https://api.onlinecompiler.io"
  ).replace(/\/$/, "");
}

function looksLikeCompileError(language, errorText) {
  if (language === "python") return false;
  const e = String(errorText || "");
  return /error:|fatal error:|\.c:\d+|Main\.c|undefined reference|cannot find symbol|\.java:\d+|javac |expected ['"`]|compilation terminated/i.test(
    e
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/run-code-sync/ — sandboxed Docker execution.
 * Auth: Authorization: <API_KEY> (server-side only).
 */
async function runOnceOnlineCompiler(language, code, stdin, attempt = 0) {
  const compiler = ONLINECOMPILER_COMPILERS[language];
  if (!compiler) {
    return { ok: false, error: `Unsupported language: ${language}` };
  }

  const apiKey = String(process.env.ONLINECOMPILER_API_KEY || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Code execution provider is not configured. Set ONLINECOMPILER_API_KEY on the server.",
    };
  }

  const url = `${onlineCompilerBase()}/api/run-code-sync/`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler,
        code,
        input: stdin ?? "",
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `Execution service unreachable: ${err.message}`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error:
        "Execution provider rejected the API key. Check ONLINECOMPILER_API_KEY.",
    };
  }

  if (res.status === 429) {
    // Free tier: max 4 concurrent sync requests. Queue + brief retry.
    if (attempt < 3) {
      await sleep(400 * (attempt + 1));
      return runOnceOnlineCompiler(language, code, stdin, attempt + 1);
    }
    return {
      ok: false,
      error:
        "Execution provider is at capacity (rate limited). Please wait and try again.",
    };
  }

  if (res.status === 402) {
    return {
      ok: false,
      error:
        "Execution provider free quota exhausted. Code execution is temporarily unavailable.",
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, 240);
    if (/quota|limit|exceeded|billing/i.test(snippet)) {
      return {
        ok: false,
        error:
          "Execution provider free quota exhausted. Code execution is temporarily unavailable.",
      };
    }
    return {
      ok: false,
      error: `Execution service error (${res.status}): ${snippet || res.statusText}`,
    };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "Execution service returned invalid JSON." };
  }

  const stdout = normalizeOutput(data.output);
  const stderr = normalizeOutput(data.error);
  const exitCode =
    data.exit_code == null || data.exit_code === ""
      ? null
      : Number(data.exit_code);
  const signal = data.signal;

  // Provider docs: 124 = timeout; 137 / SIGKILL = memory or timeout
  if (
    exitCode === 124 ||
    (exitCode === 137 && Number(signal) === 9) ||
    /time.?limit|timed out|timeout/i.test(stderr)
  ) {
    return { ok: false, timeout: true, error: "Time limit exceeded." };
  }

  if (data.status === "success" || exitCode === 0) {
    return { ok: true, output: stdout };
  }

  if (looksLikeCompileError(language, stderr)) {
    return {
      ok: false,
      compileError: true,
      error: stderr || "Compilation failed.",
    };
  }

  if (data.status === "error" || (exitCode != null && exitCode !== 0)) {
    if (
      (language === "c" || language === "java") &&
      stderr &&
      !stdout &&
      exitCode !== 1
    ) {
      if (
        /error|undefined|symbol|expected/i.test(stderr) &&
        !/Exception|Traceback|Segmentation/i.test(stderr)
      ) {
        return {
          ok: false,
          compileError: true,
          error: stderr || "Compilation failed.",
        };
      }
    }
    return {
      ok: false,
      runtimeError: true,
      error: stderr || data.message || "Runtime error.",
      output: stdout,
    };
  }

  return { ok: true, output: stdout };
}

/* ------------------------------------------------------------------ */
/* Provider selection                                                 */
/* ------------------------------------------------------------------ */

async function runOnce(language, code, stdin) {
  const provider = (process.env.EXECUTION_PROVIDER || "").toLowerCase();

  if (
    provider === "onlinecompiler" ||
    (provider !== "local" && onlineCompilerConfigured())
  ) {
    return runOnceOnlineCompiler(language, code, stdin);
  }

  const tools = await resolveTools();
  const needed =
    language === "python"
      ? tools.python
      : language === "c"
        ? tools.gcc
        : tools.javac && tools.java;

  if (!needed) {
    if (onlineCompilerConfigured()) {
      return runOnceOnlineCompiler(language, code, stdin);
    }
    return {
      ok: false,
      compileError: language !== "python",
      error:
        language === "python"
          ? "Python is not available. Set ONLINECOMPILER_API_KEY for production execution."
          : language === "c"
            ? "GCC is not available. Set ONLINECOMPILER_API_KEY for production C execution."
            : "Java JDK is not available. Set ONLINECOMPILER_API_KEY for production Java execution.",
    };
  }

  return runOnceLocal(language, code, stdin, tools);
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {{ language: string, code: string, testCases: Array<{id:any, input:string, expected_output?:string, expectedOutput?:string}> }}
 */
export async function runAgainstTestCases({ language, code, testCases }) {
  if (!["python", "c", "java"].includes(language)) {
    return {
      status: "error",
      message: `Unsupported language: ${language}`,
      results: [],
      passed_test_cases: 0,
      total_test_cases: 0,
      execution_time: 0,
    };
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    return {
      status: "error",
      message: "No test cases configured.",
      results: [],
      passed_test_cases: 0,
      total_test_cases: 0,
      execution_time: 0,
    };
  }

  return withConcurrency(async () => {
    const started = Date.now();
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const expected = tc.expected_output ?? tc.expectedOutput ?? "";
      const result = await runOnce(language, code, tc.input ?? "");

      if (result.compileError) {
        return {
          status: "compile_error",
          message: result.error,
          results: testCases.map((t, idx) => ({
            id: t.id ?? idx + 1,
            status: "error",
            error: result.error,
          })),
          passed_test_cases: 0,
          total_test_cases: testCases.length,
          execution_time: (Date.now() - started) / 1000,
        };
      }

      const id = tc.id ?? i + 1;

      if (result.timeout) {
        results.push({ id, status: "timeout", error: result.error });
        continue;
      }
      if (result.runtimeError || !result.ok) {
        results.push({
          id,
          status: "runtime_error",
          error: result.error || "Runtime error.",
        });
        continue;
      }

      results.push({
        id,
        status: outputsMatch(result.output, expected) ? "passed" : "failed",
      });
    }

    const passed = results.filter((r) => r.status === "passed").length;

    return {
      status: "ok",
      results,
      passed_test_cases: passed,
      total_test_cases: testCases.length,
      execution_time: (Date.now() - started) / 1000,
    };
  });
}

export async function getExecutionTools() {
  const tools = await resolveTools();
  const remote = onlineCompilerConfigured();
  return {
    ...tools,
    provider: remote
      ? process.env.EXECUTION_PROVIDER || "onlinecompiler"
      : "local",
    onlinecompiler: remote,
    maxConcurrent: MAX_CONCURRENT,
    active,
    queued: waitQueue.length,
  };
}
