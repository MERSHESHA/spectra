import "./loadEnv.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function adminSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    "dev-admin-secret-change-me"
  );
}

function studentSecret() {
  return process.env.STUDENT_JWT_SECRET || "dev-student-secret-change-me";
}

const ADMIN_TTL = "12h";
const STUDENT_TTL = "2h";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAdminToken(payload) {
  return jwt.sign({ ...payload, role: "admin" }, adminSecret(), {
    expiresIn: ADMIN_TTL,
  });
}

export function verifyAdminToken(token) {
  const decoded = jwt.verify(token, adminSecret());
  if (decoded.role !== "admin") throw new Error("Invalid admin token");
  return decoded;
}

export function signStudentToken(payload) {
  return jwt.sign({ ...payload, role: "student" }, studentSecret(), {
    expiresIn: STUDENT_TTL,
  });
}

export function verifyStudentToken(token) {
  const decoded = jwt.verify(token, studentSecret());
  if (decoded.role !== "student") throw new Error("Invalid student token");
  return decoded;
}

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export function requireAdmin(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  try {
    return verifyAdminToken(token);
  } catch {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

export function requireStudent(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  try {
    return verifyStudentToken(token);
  } catch {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}
