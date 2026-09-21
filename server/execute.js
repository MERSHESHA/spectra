/**
 * Local sandboxed code execution (C / Java / Python).
 * Used by the API server — not imported by the frontend.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const RUN_TIMEOUT_MS = 4000;
const COMPILE_TIMEOUT_MS = 8000;

function normalizeOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd();
}

function runProcess(command, args, { cwd, stdin = "", timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
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
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
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
    if (result.error && /ENOENT|not recognized|Failed to start/i.test(result.error)) {
      continue;
    }
    if (result.code !== null || result.stdout || result.stderr) {
      return cmd;
    }
  }
  return null;
}

let toolCache = null;

async function resolveTools() {
  if (toolCache) return toolCache;
  toolCache = {
    python: await whichCommand(["python", "py", "python3"]),
    gcc: await whichCommand(["gcc"]),
    javac: await whichCommand(["javac"]),
    java: await whichCommand(["java"]),
  };
  return toolCache;
}

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), `spectra-${randomUUID()}-`)
  );
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executePython(code, stdin, tools) {
  if (!tools.python) {
    return { ok: false, error: "Python is not installed on the execution server." };
  }
  return withTempDir(async (dir) => {
    const file = path.join(dir, "main.py");
    await fs.writeFile(file, code, "utf8");
    const result = await runProcess(tools.python, [file], {
      cwd: dir,
      stdin,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    if (result.timeout) return { ok: false, timeout: true, error: "Time limit exceeded." };
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

async function executeC(code, stdin, tools) {
  if (!tools.gcc) {
    return { ok: false, compileError: true, error: "GCC is not installed on the execution server." };
  }
  return withTempDir(async (dir) => {
    const source = path.join(dir, "main.c");
    const binary = path.join(dir, process.platform === "win32" ? "main.exe" : "main");
    await fs.writeFile(source, code, "utf8");
    const compile = await runProcess(tools.gcc, [source, "-O2", "-o", binary], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.timeout) return { ok: false, timeout: true, error: "Compilation timed out." };
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
    if (result.timeout) return { ok: false, timeout: true, error: "Time limit exceeded." };
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

async function executeJava(code, stdin, tools) {
  if (!tools.javac || !tools.java) {
    return { ok: false, compileError: true, error: "Java JDK is not installed on the execution server." };
  }
  return withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "Main.java"), code, "utf8");
    const compile = await runProcess(tools.javac, ["Main.java"], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.timeout) return { ok: false, timeout: true, error: "Compilation timed out." };
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
    if (result.timeout) return { ok: false, timeout: true, error: "Time limit exceeded." };
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

async function runOnce(language, code, stdin, tools) {
  if (language === "python") return executePython(code, stdin, tools);
  if (language === "c") return executeC(code, stdin, tools);
  if (language === "java") return executeJava(code, stdin, tools);
  return { ok: false, error: `Unsupported language: ${language}` };
}

/**
 * @param {{ language: string, code: string, testCases: Array<{id: any, input: string, expected_output?: string, expectedOutput?: string}> }}
 * @returns {{ status, message?, results, passed_test_cases, total_test_cases, execution_time }}
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

  const tools = await resolveTools();
  const started = Date.now();
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const expected = normalizeOutput(tc.expected_output ?? tc.expectedOutput ?? "");
    const result = await runOnce(language, code, tc.input ?? "", tools);

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

    const actual = normalizeOutput(result.output);
    results.push({
      id,
      status: actual === expected ? "passed" : "failed",
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
}

export async function getExecutionTools() {
  return resolveTools();
}
