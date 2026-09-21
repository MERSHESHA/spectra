/**
 * Create or update an admin user.
 * Usage: node server/scripts/createAdmin.js <username> <password>
 */
import "../loadEnv.js";
import { requireDb } from "../db.js";
import { hashPassword } from "../auth.js";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("Usage: node server/scripts/createAdmin.js <username> <password>");
  process.exit(1);
}

const db = requireDb();
const password_hash = await hashPassword(password);

const { error } = await db.from("admins").upsert(
  { username, password_hash },
  { onConflict: "username" }
);

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Admin "${username}" saved.`);
