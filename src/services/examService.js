/**
 * Student exam API client.
 * Talks only to the backend — never reads scores/leaderboard.
 */

import { apiUrl } from "../lib/apiBase";

const PARTICIPANT_KEY = "codingParticipant";
const SESSION_KEY = "examSessionToken";
const EXAM_META_KEY = "examSessionMeta";

export const QuestionState = {
  NOT_STARTED: "NOT_STARTED",
  RUNNING: "RUNNING",
  TESTED: "TESTED",
  SUBMITTED: "SUBMITTED",
};

function readJson(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function getStoredParticipant() {
  return readJson(PARTICIPANT_KEY);
}

export function storeParticipant(participant) {
  writeJson(PARTICIPANT_KEY, participant);
}

export function clearExamSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(EXAM_META_KEY);
}

function getToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

function setToken(token) {
  if (token) sessionStorage.setItem(SESSION_KEY, token);
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

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
    throw new Error("Invalid response from the exam server.");
  }

  if (!response.ok) {
    const err = new Error(data.message || data.error || "Request failed");
    err.code = data.error;
    err.status = response.status;
    throw err;
  }

  return data;
}

function persistMeta(state) {
  if (state.token) setToken(state.token);
  writeJson(EXAM_META_KEY, {
    examId: state.examId,
    studentId: state.studentId,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
  });
}

export async function startExam(participant) {
  const state = await api("/exam/start", {
    method: "POST",
    body: participant,
    auth: false,
  });
  persistMeta(state);
  return state;
}

export async function getExamState() {
  const state = await api("/exam/state");
  persistMeta(state);
  return state;
}

export async function submitAnswer({ questionId, language, code }) {
  try {
    return await api("/exam/submit", {
      method: "POST",
      body: { questionId, language, code },
    });
  } catch (err) {
    if (err.code === "EXAM_ENDED" || err.message?.includes("ended")) {
      return { ok: false, error: "EXAM_ENDED" };
    }
    if (err.code === "LEVEL_LOCKED") {
      return { ok: false, error: "LEVEL_LOCKED" };
    }
    if (err.code === "EMPTY_CODE") {
      return { ok: false, error: "EMPTY_CODE" };
    }
    throw err;
  }
}

export function getQuestionSubmissionState(submissions, questionId) {
  return submissions?.[questionId]?.state ?? QuestionState.NOT_STARTED;
}

export function isLevelUnlocked(unlockedLevel, level) {
  return level <= unlockedLevel;
}
