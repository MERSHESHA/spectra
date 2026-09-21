import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import CodeEditor from "../components/CodeEditor";
import QuestionPanel from "../components/QuestionPanel";
import TestResults from "../components/TestResults";
import { levels, LEVEL_IDS, getQuestionsForLevel } from "../data/questions";
import { useExamFullscreen, useExamTimer } from "../hooks/useExam";
import { runCodeAgainstTestCases } from "../services/codeExecutionService";
import {
  getStoredParticipant,
  getQuestionSubmissionState,
  QuestionState,
  startExam,
  submitAnswer,
} from "../services/examService";

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

function starterFor(question, language) {
  return question?.starterCode?.[language] ?? "";
}

export default function CodingPage() {
  const navigate = useNavigate();

  const [participant, setParticipant] = useState(null);
  const [examMeta, setExamMeta] = useState(null); // { startedAt, endsAt, examId }
  const [submissions, setSubmissions] = useState({});
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [examComplete, setExamComplete] = useState(false);
  const [bootError, setBootError] = useState(null);

  const [activeLevel, setActiveLevel] = useState(1);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Per-question local editor state (no continuous backend writes)
  const [editorState, setEditorState] = useState({});
  // Per-question run results
  const [runState, setRunState] = useState({});

  const [submitting, setSubmitting] = useState(false);

  const { remainingMs, expired, formatTime } = useExamTimer(examMeta?.endsAt);
  const {
    containerRef,
    showWarning,
    enterFullscreen,
  } = useExamFullscreen(Boolean(participant && examMeta && !expired && !examComplete));

  const questions = useMemo(
    () => getQuestionsForLevel(activeLevel),
    [activeLevel]
  );
  const currentQuestion = questions[activeQuestionIndex] ?? null;
  const currentQuestionId = currentQuestion?.id;

  const questionStatus = getQuestionSubmissionState(
    submissions,
    currentQuestionId
  );
  const isSubmitted = questionStatus === QuestionState.SUBMITTED;

  const currentEditor = currentQuestionId
    ? editorState[currentQuestionId]
    : null;
  const language = currentEditor?.language ?? "python";
  const code = currentEditor?.code ?? "";

  const currentRun = currentQuestionId ? runState[currentQuestionId] : null;

  /* ---------- Boot exam session ---------- */
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const saved = getStoredParticipant();
      if (!saved) {
        navigate("/");
        return;
      }

      try {
        const state = await startExam(saved);
        if (cancelled) return;

        setParticipant(saved);
        setExamMeta({
          examId: state.examId,
          startedAt: state.startedAt,
          endsAt: state.endsAt,
        });
        setSubmissions(state.submissions || {});
        setUnlockedLevel(state.unlockedLevel || 1);
        setExamComplete(Boolean(state.examComplete));
        setActiveLevel(state.unlockedLevel || 1);
        setActiveQuestionIndex(0);
      } catch (err) {
        if (!cancelled) {
          setBootError(err.message || "Failed to start exam.");
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  /* ---------- Ensure editor state exists for active question ---------- */
  useEffect(() => {
    if (!currentQuestion) return;

    setEditorState((prev) => {
      if (prev[currentQuestion.id]) return prev;
      const lang = "python";
      return {
        ...prev,
        [currentQuestion.id]: {
          language: lang,
          code: starterFor(currentQuestion, lang),
        },
      };
    });
  }, [currentQuestion]);

  const setLanguage = useCallback(
    (nextLang) => {
      if (!currentQuestion || isSubmitted || expired) return;
      setEditorState((prev) => {
        const existing = prev[currentQuestion.id];
        const prevLang = existing?.language ?? "python";
        const prevCode = existing?.code ?? "";
        const wasStarter =
          !prevCode.trim() ||
          prevCode === starterFor(currentQuestion, prevLang);

        return {
          ...prev,
          [currentQuestion.id]: {
            language: nextLang,
            code: wasStarter
              ? starterFor(currentQuestion, nextLang)
              : prevCode,
          },
        };
      });
      // Clear previous run results when language changes
      setRunState((prev) => {
        const next = { ...prev };
        delete next[currentQuestion.id];
        return next;
      });
    },
    [currentQuestion, isSubmitted, expired]
  );

  const setCode = useCallback(
    (nextCode) => {
      if (!currentQuestion || isSubmitted || expired) return;
      setEditorState((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          language: prev[currentQuestion.id]?.language ?? "python",
          code: nextCode,
        },
      }));
    },
    [currentQuestion, isSubmitted, expired]
  );

  const handleSelectLevel = (level) => {
    if (level > unlockedLevel) return;
    setActiveLevel(level);
    setActiveQuestionIndex(0);
  };

  const handleSelectQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;
    setActiveQuestionIndex(index);
  };

  const handleRunCode = async () => {
    if (!currentQuestion || isSubmitted || expired || examComplete) return;
    if (!code.trim()) return;

    const qid = currentQuestion.id;

    setRunState((prev) => ({
      ...prev,
      [qid]: { status: "running", message: null, results: null },
    }));

    try {
      const result = await runCodeAgainstTestCases({
        language,
        code,
        questionId: qid,
      });

      setRunState((prev) => ({
        ...prev,
        [qid]: {
          status: result.status,
          message: result.message,
          results: result.results,
        },
      }));
    } catch (err) {
      setRunState((prev) => ({
        ...prev,
        [qid]: {
          status: "error",
          message: err.message || "Failed to run code.",
          results: null,
        },
      }));
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || isSubmitted || expired || examComplete || submitting)
      return;
    if (!code.trim()) return;

    setSubmitting(true);
    try {
      const result = await submitAnswer({
        questionId: currentQuestion.id,
        language,
        code,
      });

      if (!result.ok) {
        if (result.error === "EXAM_ENDED") {
          setExamComplete(false);
          // Timer will flip expired via endsAt
        }
        setSubmitting(false);
        return;
      }

      setSubmissions((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          state: QuestionState.SUBMITTED,
          submittedAt: Date.now(),
          language,
        },
      }));

      if (result.unlockedLevel) {
        setUnlockedLevel(result.unlockedLevel);
      }
      if (result.examComplete) {
        setExamComplete(true);
      }

      // Auto-advance to next unsubmitted question in level, if any
      const levelQuestions = getQuestionsForLevel(activeLevel);
      const nextIndex = levelQuestions.findIndex(
        (q, i) =>
          i > activeQuestionIndex &&
          getQuestionSubmissionState(
            {
              ...submissions,
              [currentQuestion.id]: { state: QuestionState.SUBMITTED },
            },
            q.id
          ) !== QuestionState.SUBMITTED
      );

      if (nextIndex >= 0) {
        setActiveQuestionIndex(nextIndex);
      } else if (
        result.levelJustUnlocked &&
        result.levelJustUnlocked <= 3
      ) {
        setActiveLevel(result.levelJustUnlocked);
        setActiveQuestionIndex(0);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <p className="text-red-400">{bootError}</p>
      </div>
    );
  }

  if (!participant || !examMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <p className="text-sm text-gray-500">Loading exam…</p>
      </div>
    );
  }

  const examEnded = expired || examComplete;
  const runDisabled =
    examEnded ||
    isSubmitted ||
    currentRun?.status === "running" ||
    !code.trim();
  const submitDisabled =
    examEnded || isSubmitted || submitting || !code.trim();

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-x-hidden overflow-y-auto bg-[#050505] text-white"
    >
      {/* Fullscreen warning */}
      {showWarning && !examEnded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 text-center shadow-2xl">
            <h2 className="text-xl font-bold">Fullscreen required</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              The exam should remain in fullscreen mode. Your browser may exit
              fullscreen when Escape is pressed — click below to return.
            </p>
            <button
              type="button"
              onClick={enterFullscreen}
              className="mt-6 w-full rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:bg-cyan-300"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Exam ended overlay */}
      {examEnded && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 px-5">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-bold">
              {examComplete ? "Exam Completed" : "Time's Up"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              {examComplete
                ? "You have submitted all questions. The exam is complete."
                : "The 60-minute exam has ended. Submissions are no longer accepted."}
            </p>
            <p className="mt-4 text-xs text-gray-600">
              {participant.name} · {participant.registerNumber}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              CODE<span className="text-cyan-400">X</span>
            </h1>
            <p className="text-[10px] text-gray-500">CODING CHALLENGE</p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{participant.name}</p>
            <p className="text-xs text-gray-500">
              {participant.registerNumber}
            </p>
          </div>

          <div
            className={`rounded-lg border px-4 py-2 font-mono text-sm font-bold ${
              remainingMs <= 5 * 60 * 1000
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-white/10 bg-white/5 text-cyan-400"
            }`}
          >
            {formatTime()}
          </div>
        </div>
      </header>

      {/* Level navigation */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-[1600px] items-center px-5">
          {LEVEL_IDS.map((level) => {
            const levelQuestions = levels[level];
            const allSubmitted = levelQuestions.every(
              (q) =>
                getQuestionSubmissionState(submissions, q.id) ===
                QuestionState.SUBMITTED
            );
            const isLocked = level > unlockedLevel;
            const isCurrent = activeLevel === level && !allSubmitted;
            const isCompleted = allSubmitted;

            return (
              <div key={level} className="flex flex-1 items-center">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectLevel(level)}
                  className={`flex items-center gap-3 py-4 text-left transition ${
                    isLocked
                      ? "cursor-not-allowed opacity-50"
                      : "hover:opacity-90"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted
                        ? "bg-green-400 text-black"
                        : isCurrent
                        ? "bg-cyan-400 text-black"
                        : isLocked
                        ? "bg-white/10 text-gray-500"
                        : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {isCompleted ? "✓" : isLocked ? "🔒" : level}
                  </div>

                  <div className="hidden sm:block">
                    <p
                      className={`text-sm font-medium ${
                        isLocked ? "text-gray-600" : "text-gray-200"
                      }`}
                    >
                      Level {level}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      {isCompleted
                        ? "✓ Completed"
                        : isCurrent
                        ? "● Current"
                        : isLocked
                        ? "🔒 Locked"
                        : "Available"}
                    </p>
                  </div>
                </button>

                {level !== 3 && (
                  <div
                    className={`mx-4 h-px flex-1 ${
                      allSubmitted ? "bg-green-400/50" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Question tabs */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-5 py-3">
          {questions.map((q, index) => {
            const state = getQuestionSubmissionState(submissions, q.id);
            const selected = index === activeQuestionIndex;
            const submitted = state === QuestionState.SUBMITTED;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => handleSelectQuestion(index)}
                className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selected
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                    : "border-white/10 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]"
                }`}
              >
                Question {index + 1}
                {submitted && (
                  <span className="ml-2 text-green-400">✓ Submitted</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main workspace */}
      <main className="mx-auto max-w-[1600px] px-5 py-6">
        {currentQuestion && (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <QuestionPanel
              level={activeLevel}
              question={currentQuestion}
              questionNumber={activeQuestionIndex + 1}
              totalInLevel={questions.length}
            />

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
              {/* Editor toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isSubmitted || examEnded}
                  className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {isSubmitted ? (
                    <span className="font-semibold text-green-400">
                      ✓ Submitted
                    </span>
                  ) : (
                    <span>Your code is evaluated against test cases</span>
                  )}
                </div>
              </div>

              <div className="p-4">
                <CodeEditor
                  language={language}
                  code={code}
                  onChange={setCode}
                  readOnly={isSubmitted || examEnded}
                />
              </div>

              {/* Test results — pass/fail only, never marks */}
              <div className="border-t border-white/10 px-4 py-4">
                <TestResults
                  status={currentRun?.status}
                  message={currentRun?.message}
                  results={currentRun?.results}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={runDisabled}
                  className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {currentRun?.status === "running"
                    ? "Running..."
                    : "▶ Run Code"}
                </button>

                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={submitDisabled}
                  className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitted
                    ? "✓ Submitted"
                    : submitting
                    ? "Submitting…"
                    : "Submit Answer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
