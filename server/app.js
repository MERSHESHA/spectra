import "./loadEnv.js";
import express from "express";
import cors from "cors";

import { requireAdmin, requireStudent } from "./auth.js";
import { getSupabaseAdmin, getSupabaseConfigStatus, requireDb } from "./db.js";
import * as exam from "./examService.js";
import * as admin from "./adminService.js";

const app = express();

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }
      // Same-origin Vercel deployments do not send cross-origin requests
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// Vercel catch-all (`api/[...path].js`) may strip the `/api` prefix from req.url.
// Restore it so Express routes defined as `/api/...` still match.
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }
  next();
});

function sendError(res, err) {
  const status = err.status || 500;
  console.error(`[api] ${status}:`, err.code || err.message);
  res.status(status).json({
    success: false,
    ok: false,
    error: err.code || "ERROR",
    message: err.message || "Server error.",
  });
}

/** Liveness — does not depend on Supabase */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "api", status: "ok" });
});

/** Supabase connectivity check */
app.get("/api/health/supabase", async (_req, res) => {
  try {
    const status = getSupabaseConfigStatus();
    if (!status.configured) {
      return res.status(503).json({
        success: false,
        ok: false,
        status: "error",
        supabase: "not_configured",
        message: status.initError || "Supabase environment variables are missing.",
      });
    }

    const db = requireDb();
    const { error } = await db.from("questions").select("id").limit(1);

    if (error) {
      if (
        error.code === "PGRST205" ||
        /Could not find the table/i.test(error.message)
      ) {
        return res.status(503).json({
          success: false,
          ok: false,
          status: "error",
          supabase: "schema_missing",
          message:
            "Connected to Supabase, but required tables are missing. Run supabase/schema.sql and supabase/seed.sql in the Supabase SQL Editor.",
        });
      }

      console.error("[health/supabase]", error.message);
      return res.status(503).json({
        success: false,
        ok: false,
        status: "error",
        supabase: "unreachable",
        message: "Database request failed.",
      });
    }

    return res.json({
      ok: true,
      status: "ok",
      supabase: "connected",
    });
  } catch (err) {
    console.error("[health/supabase]", err.message);
    return res.status(503).json({
      success: false,
      ok: false,
      status: "error",
      supabase: "unavailable",
      message: err.message || "Supabase health check failed.",
    });
  }
});

/* ========================= Exam (student) ========================= */

app.post("/api/exam/start", async (req, res) => {
  try {
    const state = await exam.startExam(req.body);
    res.json(state);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/exam/state", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const state = await exam.getExamState(auth);
    res.json(state);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/exam/submit", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const result = await exam.submitAnswer(auth, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/execute", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const { questionId, language, code } = req.body || {};
    const result = await exam.runCode(auth, { questionId, language, code });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

/* ========================= Admin ========================= */

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await admin.adminLogin(username, password);
    res.json({ ok: true, success: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/me", async (req, res) => {
  try {
    const auth = requireAdmin(req);
    res.json({
      ok: true,
      success: true,
      username: auth.username,
      adminId: auth.adminId,
    });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/overview", async (req, res) => {
  try {
    requireAdmin(req);
    const overview = await admin.getOverview();
    res.json(overview);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/leaderboard", async (req, res) => {
  try {
    requireAdmin(req);
    const leaderboard = await admin.getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/students/:id", async (req, res) => {
  try {
    requireAdmin(req);
    const detail = await admin.getStudentDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/evaluation-criteria", async (req, res) => {
  try {
    requireAdmin(req);
    res.json(admin.getEvaluationCriteria());
  } catch (err) {
    sendError(res, err);
  }
});

// Eager init when configured (safe no-op if missing)
try {
  const bootStatus = getSupabaseConfigStatus();
  if (bootStatus.configured) getSupabaseAdmin();
} catch (err) {
  console.error("[startup] Supabase init:", err.message);
}

export default app;
