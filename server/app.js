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
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/**
 * Vercel may invoke this app as /api (after rewrite) with either:
 *   /api/exam/start  or  /exam/start
 * Normalize so Express routes always see /api/...
 */
app.use((req, _res, next) => {
  const headerPath =
    req.headers["x-invoke-path"] ||
    req.headers["x-forwarded-uri"] ||
    "";
  const raw = String(headerPath || req.originalUrl || req.url || "");
  const pathOnly = raw.split("?")[0];
  if (pathOnly && pathOnly !== "/" && !pathOnly.startsWith("/api")) {
    const suffix = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
    req.url = `/api${suffix}${raw.includes("?") ? raw.slice(raw.indexOf("?")) : ""}`;
  } else if (req.url && !req.url.startsWith("/api") && req.url !== "/") {
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

const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", status: "ok" });
});

api.get("/health/supabase", async (_req, res) => {
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

api.post("/exam/start", async (req, res) => {
  try {
    const state = await exam.startExam(req.body);
    res.json(state);
  } catch (err) {
    sendError(res, err);
  }
});

api.get("/exam/state", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const state = await exam.getExamState(auth);
    res.json(state);
  } catch (err) {
    sendError(res, err);
  }
});

api.post("/exam/submit", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const result = await exam.submitAnswer(auth, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

api.post("/execute", async (req, res) => {
  try {
    const auth = requireStudent(req);
    const { questionId, language, code } = req.body || {};
    const result = await exam.runCode(auth, { questionId, language, code });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

api.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await admin.adminLogin(username, password);
    res.json({ ok: true, success: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
});

api.get("/admin/me", async (req, res) => {
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

api.get("/admin/overview", async (req, res) => {
  try {
    requireAdmin(req);
    const overview = await admin.getOverview();
    res.json(overview);
  } catch (err) {
    sendError(res, err);
  }
});

api.get("/admin/leaderboard", async (req, res) => {
  try {
    requireAdmin(req);
    const leaderboard = await admin.getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    sendError(res, err);
  }
});

api.get("/admin/students/:id", async (req, res) => {
  try {
    requireAdmin(req);
    const detail = await admin.getStudentDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    sendError(res, err);
  }
});

api.get("/admin/evaluation-criteria", async (req, res) => {
  try {
    requireAdmin(req);
    res.json(admin.getEvaluationCriteria());
  } catch (err) {
    sendError(res, err);
  }
});

api.use((req, res) => {
  res.status(404).json({
    success: false,
    ok: false,
    error: "NOT_FOUND",
    message: `No API route for ${req.method} ${req.originalUrl || req.url}`,
  });
});

// Mount at both prefixes so local (`/api/...`) and Vercel rewrite (`/exam/...`) work.
app.use("/api", api);
app.use("/", api);

try {
  const bootStatus = getSupabaseConfigStatus();
  if (bootStatus.configured) getSupabaseAdmin();
} catch (err) {
  console.error("[startup] Supabase init:", err.message);
}

export default app;
