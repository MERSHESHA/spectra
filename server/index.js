/**
 * Local development server.
 * Production on Vercel uses api/index.js (serverless) — do not rely on listen() there.
 */
import "./loadEnv.js";
import app from "./app.js";
import { getSupabaseConfigStatus } from "./db.js";

const PORT = Number(process.env.PORT) || 3001;

function envLoaded() {
  return Boolean(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

console.log("Server starting...");
console.log(`Environment loaded: ${envLoaded() ? "yes" : "no"}`);
const bootStatus = getSupabaseConfigStatus();
console.log(`Supabase configured: ${bootStatus.configured ? "yes" : "no"}`);
if (!bootStatus.configured) {
  console.warn(
    "[startup] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then restart."
  );
} else {
  console.log(
    `Supabase client: ${bootStatus.clientReady ? "ready" : "failed"}`
  );
}
console.log(`Port: ${PORT}`);

app.listen(PORT, () => {
  console.log(`SPECTRA API listening on http://localhost:${PORT}`);
});
