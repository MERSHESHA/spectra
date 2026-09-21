/**
 * Admin API client — all routes require a verified backend JWT.
 * Scores / leaderboard are never exposed on student endpoints.
 */

import { apiUrl } from "../lib/apiBase";

const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_USER_KEY = "adminUsername";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminUsername() {
  return localStorage.getItem(ADMIN_USER_KEY);
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

function setAdminSession(token, username) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (username) localStorage.setItem(ADMIN_USER_KEY, username);
}

async function adminApi(path, { method = "GET", body } = {}) {
  const token = getAdminToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Unable to connect to server");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from the admin API.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminSession();
    }
    const err = new Error(data.message || "Request failed");
    err.status = response.status;
    throw err;
  }

  return data;
}

export async function adminLogin(username, password) {
  const data = await adminApi("/admin/login", {
    method: "POST",
    body: { username, password },
  });
  setAdminSession(data.token, data.username);
  return data;
}

export async function verifyAdminSession() {
  if (!getAdminToken()) return null;
  try {
    return await adminApi("/admin/me");
  } catch {
    clearAdminSession();
    return null;
  }
}

export async function fetchOverview() {
  return adminApi("/admin/overview");
}

export async function fetchLeaderboard() {
  const data = await adminApi("/admin/leaderboard");
  return data.leaderboard || [];
}

export async function fetchStudentDetail(studentId) {
  return adminApi(`/admin/students/${studentId}`);
}

export async function fetchEvaluationCriteria() {
  return adminApi("/admin/evaluation-criteria");
}

export async function fetchAdminQuestions() {
  const data = await adminApi("/admin/questions");
  return data.questions || [];
}

export async function saveAdminQuestion(payload) {
  if (payload.id) {
    return adminApi(`/admin/questions/${payload.id}`, {
      method: "PUT",
      body: payload,
    });
  }
  return adminApi("/admin/questions", { method: "POST", body: payload });
}

export async function deleteAdminQuestion(id) {
  return adminApi(`/admin/questions/${id}`, { method: "DELETE" });
}

export async function saveAdminTestCase(payload) {
  if (payload.id) {
    return adminApi(`/admin/test-cases/${payload.id}`, {
      method: "PUT",
      body: payload,
    });
  }
  return adminApi("/admin/test-cases", { method: "POST", body: payload });
}

export async function deleteAdminTestCase(id) {
  return adminApi(`/admin/test-cases/${id}`, { method: "DELETE" });
}

/** Login without requiring an existing token */
export async function loginRequest(username, password) {
  let response;
  try {
    response = await fetch(apiUrl("/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error("Unable to connect to server");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Invalid credentials.");
  }
  setAdminSession(data.token, data.username);
  return data;
}
