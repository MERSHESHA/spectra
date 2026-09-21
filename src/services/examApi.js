/**
 * Exam session API — start / submit / state.
 *
 * Designed for a server-authoritative exam clock.
 * Until a real backend is connected, this module keeps a local
 * session that mirrors the same contract:
 *   - startExam() records startedAt / endsAt once
 *   - submitAnswer() validates against endsAt before accepting
 *   - getExamState() returns submissions + unlocked level
 *
 * No per-keystroke writes. No polling. No score exposure.
 *
 * Swap the LocalExamBackend implementation for fetch() calls
 * when your exam API is ready (see RemoteExamBackend stub).
 */

import { EXAM_DURATION_MS, levels, LEVEL_IDS } from "../data/questions";

const PARTICIPANT_KEY = "codingParticipant";
const EXAM_SESSION_KEY = "examSession";

/** Question submission states (student-visible, no marks). */
export const QuestionState = {
  NOT_STARTED: "NOT_STARTED",
  RUNNING: "RUNNING",
  TESTED: "TESTED",
  SUBMITTED: "SUBMITTED",
};

function now() {
  return Date.now();
}

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

function createEmptySubmissions() {
  /** @type {Record<string, { state: string, submittedAt: number|null, language: string|null }>} */
  const submissions = {};
  for (const level of LEVEL_IDS) {
    for (const q of levels[level]) {
      submissions[q.id] = {
        state: QuestionState.NOT_STARTED,
        submittedAt: null,
        language: null,
        // Intentionally no score / marks fields
      };
    }
  }
  return submissions;
}

function computeUnlockedLevel(submissions) {
  for (const level of LEVEL_IDS) {
    const questions = levels[level];
    const allSubmitted = questions.every(
      (q) => submissions[q.id]?.state === QuestionState.SUBMITTED
    );
    if (!allSubmitted) return level;
  }
  // All levels fully submitted
  return LEVEL_IDS[LEVEL_IDS.length - 1];
}

function isLevelComplete(submissions, level) {
  return levels[level].every(
    (q) => submissions[q.id]?.state === QuestionState.SUBMITTED
  );
}

function isExamComplete(submissions) {
  return LEVEL_IDS.every((level) => isLevelComplete(submissions, level));
}

/* ------------------------------------------------------------------ */
/* Local backend (sessionStorage) — same shape as a future HTTP API   */
/* ------------------------------------------------------------------ */

const LocalExamBackend = {
  async startExam(participant) {
    const existing = readJson(EXAM_SESSION_KEY);
    if (existing?.startedAt && existing?.endsAt) {
      return {
        examId: existing.examId,
        startedAt: existing.startedAt,
        endsAt: existing.endsAt,
        submissions: existing.submissions,
        unlockedLevel: computeUnlockedLevel(existing.submissions),
        examComplete: isExamComplete(existing.submissions),
        timedOut: now() >= existing.endsAt,
      };
    }

    const startedAt = now();
    const endsAt = startedAt + EXAM_DURATION_MS;
    const examId = `exam_${participant.registerNumber}_${startedAt}`;
    const submissions = createEmptySubmissions();

    const session = {
      examId,
      participant,
      startedAt,
      endsAt,
      submissions,
    };
    writeJson(EXAM_SESSION_KEY, session);

    return {
      examId,
      startedAt,
      endsAt,
      submissions,
      unlockedLevel: 1,
      examComplete: false,
      timedOut: false,
    };
  },

  async getExamState() {
    const session = readJson(EXAM_SESSION_KEY);
    if (!session) return null;

    const timedOut = now() >= session.endsAt;
    return {
      examId: session.examId,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      submissions: session.submissions,
      unlockedLevel: computeUnlockedLevel(session.submissions),
      examComplete: isExamComplete(session.submissions),
      timedOut,
      participant: session.participant,
    };
  },

  async submitAnswer({ questionId, language, code }) {
    const session = readJson(EXAM_SESSION_KEY);
    if (!session) {
      return { ok: false, error: "NO_SESSION" };
    }

    if (now() >= session.endsAt) {
      return { ok: false, error: "EXAM_ENDED" };
    }

    const entry = session.submissions[questionId];
    if (!entry) {
      return { ok: false, error: "UNKNOWN_QUESTION" };
    }

    if (entry.state === QuestionState.SUBMITTED) {
      return {
        ok: true,
        alreadySubmitted: true,
        questionId,
        unlockedLevel: computeUnlockedLevel(session.submissions),
        examComplete: isExamComplete(session.submissions),
      };
    }

    // Level lock check: only submit questions in the unlocked level
    const unlockedLevel = computeUnlockedLevel(session.submissions);
    const questionLevel = findQuestionLevel(questionId);
    if (questionLevel == null || questionLevel > unlockedLevel) {
      return { ok: false, error: "LEVEL_LOCKED" };
    }

    if (!code?.trim()) {
      return { ok: false, error: "EMPTY_CODE" };
    }

    session.submissions[questionId] = {
      state: QuestionState.SUBMITTED,
      submittedAt: now(),
      language: language || null,
      // Code is kept only in memory on the client for this session;
      // a real backend would persist it server-side. We store a flag only.
      hasCode: true,
    };
    writeJson(EXAM_SESSION_KEY, session);

    return {
      ok: true,
      alreadySubmitted: false,
      questionId,
      unlockedLevel: computeUnlockedLevel(session.submissions),
      levelJustUnlocked:
        questionLevel < 3 &&
        isLevelComplete(session.submissions, questionLevel)
          ? questionLevel + 1
          : null,
      examComplete: isExamComplete(session.submissions),
    };
  },
};

function findQuestionLevel(questionId) {
  for (const level of LEVEL_IDS) {
    if (levels[level].some((q) => q.id === questionId)) return level;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Remote stub — replace LocalExamBackend when API exists             */
/* ------------------------------------------------------------------ */

const USE_REMOTE =
  Boolean(import.meta.env.VITE_EXAM_API_URL) &&
  import.meta.env.VITE_USE_REMOTE_EXAM === "true";

const EXAM_API_URL = import.meta.env.VITE_EXAM_API_URL || "/api/exam";

const RemoteExamBackend = {
  async startExam(participant) {
    const res = await fetch(`${EXAM_API_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error("Failed to start exam");
    return res.json();
  },

  async getExamState() {
    const res = await fetch(`${EXAM_API_URL}/state`);
    if (!res.ok) return null;
    return res.json();
  },

  async submitAnswer(payload) {
    const res = await fetch(`${EXAM_API_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};

const backend = USE_REMOTE ? RemoteExamBackend : LocalExamBackend;

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export function getStoredParticipant() {
  return readJson(PARTICIPANT_KEY);
}

export function storeParticipant(participant) {
  writeJson(PARTICIPANT_KEY, participant);
}

export async function startExam(participant) {
  return backend.startExam(participant);
}

export async function getExamState() {
  return backend.getExamState();
}

export async function submitAnswer(payload) {
  return backend.submitAnswer(payload);
}

export function isLevelUnlocked(unlockedLevel, level) {
  return level <= unlockedLevel;
}

export function getQuestionSubmissionState(submissions, questionId) {
  return submissions?.[questionId]?.state ?? QuestionState.NOT_STARTED;
}

export { isLevelComplete, isExamComplete, computeUnlockedLevel };
