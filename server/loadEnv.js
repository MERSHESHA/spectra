import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
const localPath = path.join(__dirname, "..", ".env.local");

const result = dotenv.config({ path: envPath, override: true });
dotenv.config({ path: localPath, override: true });

if (result.error && result.error.code !== "ENOENT") {
  console.warn("[env] Failed to load .env:", result.error.message);
} else {
  const count = Object.keys(result.parsed || {}).length;
  console.log(`[env] Loaded ${count} variable(s) from .env`);
}
