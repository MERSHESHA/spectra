import "./loadEnv.js";
import { createClient } from "@supabase/supabase-js";

let supabaseAdmin = null;
let initAttempted = false;
let initError = null;

function readConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/^\\+/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, serviceKey };
}

/**
 * Lazy-init service-role client so a server started before `.env` was filled
 * can still connect after env is available (or after restart).
 * Never log secret values.
 */
export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const { url, serviceKey } = readConfig();

  if (!url) {
    initError = "SUPABASE_URL is missing";
    return null;
  }
  if (!serviceKey) {
    initError = "SUPABASE_SERVICE_ROLE_KEY is missing";
    return null;
  }

  if (
    url.includes("YOUR_SUPABASE") ||
    serviceKey.includes("YOUR_SUPABASE")
  ) {
    initError = "Supabase environment variables still contain placeholders";
    return null;
  }

  try {
    supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    initAttempted = true;
    initError = null;
    return supabaseAdmin;
  } catch (err) {
    initAttempted = true;
    initError = err.message || "Failed to create Supabase client";
    console.error("[db] Supabase client init failed:", initError);
    return null;
  }
}

export function getSupabaseConfigStatus() {
  const { url, serviceKey } = readConfig();
  return {
    configured: Boolean(url && serviceKey && !url.includes("YOUR_SUPABASE")),
    hasUrl: Boolean(url),
    hasServiceRoleKey: Boolean(serviceKey),
    clientReady: Boolean(supabaseAdmin || getSupabaseAdmin()),
    initError,
    initAttempted,
  };
}

export function requireDb() {
  const client = getSupabaseAdmin();
  if (!client) {
    const err = new Error(
      initError ||
        "Supabase is not configured on the server. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    err.status = 503;
    err.code = "SUPABASE_UNAVAILABLE";
    throw err;
  }
  return client;
}

/** @deprecated use getSupabaseAdmin() / requireDb() */
export { supabaseAdmin };
