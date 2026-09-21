/**
 * Local sandboxed code-execution server (C / Java / Python).
 *
 * Runs student code in temporary directories with timeouts.
 * Replace with your hardened sandbox in production.
 *
 * Frontend contract (POST /api/execute):
 *   { language, code, testCases: [{ id, input, expectedOutput }] }
 *   → { status, message?, results: [{ id, status, error? }] }
 *
 * Run:  npm run dev:compiler
 */

import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.COMPILER_PORT) || 3001;
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
        error: code === 0 ? null : normalizeOutput(stderr) || `Exit code ${code}`,
      });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

async function whichCommand(candidates) {
  for (const cmd of candidates) {
    const result = await runProcess(cmd, ["--version"], {
      cwd: os.tmpdir(),
      timeoutMs: 3000,
    });
    // --version may return non-zero on some tools; "not found" is the failure
    if (!result.error?.includes("Failed to start") && result.code !== null) {
      return cmd;
    }
    // spawn error means missing
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `spectra-${randomUUID()}-`));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executePython(code, stdin, tools) {
  if (!tools.python) {
    return {
      ok: false,
      error: "Python is not installed on the execution server.",
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

async function executeC(code, stdin, tools) {
  if (!tools.gcc) {
    return {
      ok: false,
      compileError: true,
      error: "GCC is not installed on the execution server.",
    };
  }

  return withTempDir(async (dir) => {
    const source = path.join(dir, "main.c");
    const binary = path.join(dir, process.platform === "win32" ? "main.exe" : "main");
    await fs.writeFile(source, code, "utf8");

    const compile = await runProcess(tools.gcc, [source, "-O2", "-o", binary], {
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

async function executeJava(code, stdin, tools) {
  if (!tools.javac || !tools.java) {
    return {
      ok: false,
      compileError: true,
      error: "Java JDK is not installed on the execution server.",
    };
  }

  return withTempDir(async (dir) => {
    const source = path.join(dir, "Main.java");
    await fs.writeFile(source, code, "utf8");

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

async function runOnce(language, code, stdin, tools) {
  if (language === "python") return executePython(code, stdin, tools);
  if (language === "c") return executeC(code, stdin, tools);
  if (language === "java") return executeJava(code, stdin, tools);
  return { ok: false, error: `Unsupported language: ${language}` };
}

async function executePayload(body) {
  const { language, code, testCases } = body;

  if (!language || !code || !Array.isArray(testCases)) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Invalid payload." },
    };
  }

  if (!["python", "c", "java"].includes(language)) {
    return {
      statusCode: 400,
      body: { status: "error", message: `Unsupported language: ${language}` },
    };
  }

  const tools = await resolveTools();
  const results = [];

  for (const tc of testCases) {
    const result = await runOnce(language, code, tc.input ?? "", tools);

    if (result.compileError) {
      return {
        statusCode: 200,
        body: {
          status: "compile_error",
          message: result.error,
          results: testCases.map((t) => ({
            id: t.id,
            status: "error",
            error: result.error,
          })),
        },
      };
    }

    if (result.timeout) {
      results.push({ id: tc.id, status: "timeout", error: result.error });
      continue;
    }

    if (result.runtimeError || !result.ok) {
      results.push({
        id: tc.id,
        status: "runtime_error",
        error: result.error || "Runtime error.",
      });
      continue;
    }

    const actual = normalizeOutput(result.output);
    const expected = normalizeOutput(tc.expectedOutput);
    results.push({
      id: tc.id,
      status: actual === expected ? "passed" : "failed",
    });
  }

  return {
    statusCode: 200,
    body: { status: "ok", results },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  const payload = statusCode === 204 ? "" : JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = req.url?.split("?")[0];

  if (req.method === "POST" && (url === "/api/execute" || url === "/execute")) {
    try {
      const body = await readBody(req);
      const result = await executePayload(body);
      sendJson(res, result.statusCode, result.body);
    } catch (err) {
      sendJson(res, 500, {
        status: "error",
        message: err.message || "Server error.",
      });
    }
    return;
  }

  if (req.method === "GET" && (url === "/api/health" || url === "/health")) {
    const tools = await resolveTools();
    sendJson(res, 200, { ok: true, tools });
    return;
  }

  sendJson(res, 404, { status: "error", message: "Not found." });
});

// Restart: kill previous listener on same port if needed by user
server.listen(PORT, async () => {
  const tools = await resolveTools();
  console.log(`Code execution server on http://localhost:${PORT}`);
  console.log(
    `Tools → python: ${tools.python || "missing"}, gcc: ${tools.gcc || "missing"}, java: ${tools.java || "missing"}`
  );
});
