import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CodingPage() {
  const navigate = useNavigate();

  const [participant, setParticipant] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [completedLevels, setCompletedLevels] = useState([]);

  const [timeLeft, setTimeLeft] = useState(60 * 60);

  useEffect(() => {
    const savedParticipant = sessionStorage.getItem("codingParticipant");

    if (!savedParticipant) {
      navigate("/");
      return;
    }

    setParticipant(JSON.parse(savedParticipant));

    const savedLevel =
      Number(sessionStorage.getItem("currentLevel")) || 1;

    const savedCompleted = JSON.parse(
      sessionStorage.getItem("completedLevels") || "[]"
    );

    setCurrentLevel(savedLevel);
    setCompletedLevels(savedCompleted);
  }, [navigate]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = () => {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleLevelComplete = (level) => {
    const updatedCompleted = [
      ...new Set([...completedLevels, level]),
    ];

    setCompletedLevels(updatedCompleted);

    sessionStorage.setItem(
      "completedLevels",
      JSON.stringify(updatedCompleted)
    );

    if (level < 3) {
      const nextLevel = level + 1;

      setCurrentLevel(nextLevel);

      sessionStorage.setItem(
        "currentLevel",
        String(nextLevel)
      );
    }
  };

  if (!participant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5">
          {/* Logo */}
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              CODE<span className="text-cyan-400">X</span>
            </h1>
            <p className="text-[10px] text-gray-500">
              CODING CHALLENGE
            </p>
          </div>

          {/* Student */}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">
              {participant.name}
            </p>

            <p className="text-xs text-gray-500">
              {participant.registerNumber}
            </p>
          </div>

          {/* Timer */}
          <div
            className={`rounded-lg border px-4 py-2 font-mono text-sm font-bold ${
              timeLeft <= 300
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-white/10 bg-white/5 text-cyan-400"
            }`}
          >
            {formatTime()}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-[1600px] items-center px-5">
          {[1, 2, 3].map((level) => {
            const isCompleted =
              completedLevels.includes(level);

            const isCurrent = currentLevel === level;

            const isLocked =
              level > currentLevel;

            return (
              <div
                key={level}
                className="flex flex-1 items-center"
              >
                <div className="flex items-center gap-3 py-4">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted
                        ? "bg-green-400 text-black"
                        : isCurrent
                        ? "bg-cyan-400 text-black"
                        : "bg-white/10 text-gray-500"
                    }`}
                  >
                    {isCompleted ? "✓" : level}
                  </div>

                  <div className="hidden sm:block">
                    <p
                      className={`text-sm font-medium ${
                        isLocked
                          ? "text-gray-600"
                          : "text-gray-200"
                      }`}
                    >
                      Level {level}
                    </p>

                    <p className="text-[11px] text-gray-600">
                      {isCompleted
                        ? "Completed"
                        : isCurrent
                        ? "Current"
                        : "Locked"}
                    </p>
                  </div>
                </div>

                {level !== 3 && (
                  <div
                    className={`mx-4 h-px flex-1 ${
                      completedLevels.includes(level)
                        ? "bg-green-400/50"
                        : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-[1600px] px-5 py-6">
        {currentLevel === 1 && (
          <Level1
            onComplete={() => handleLevelComplete(1)}
          />
        )}

        {currentLevel === 2 && (
          <Level2
            onComplete={() => handleLevelComplete(2)}
          />
        )}

        {currentLevel === 3 && (
          <Level3
            onComplete={() => handleLevelComplete(3)}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------
   LEVEL 1
------------------------------------------------------- */

function Level1({ onComplete }) {
  const [code, setCode] = useState(
`# Write your solution here

def solve():
    pass

solve()`
  );

  const [language, setLanguage] = useState("python");
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const runCode = () => {
    setResult("running");

    // Temporary frontend simulation.
    // Later this will call your backend.
    setTimeout(() => {
      setResult("success");
    }, 1200);
  };

  const submitAnswer = () => {
    if (!result || result === "running") {
      return;
    }

    setSubmitted(true);

    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      {/* Question */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-6 flex items-center justify-between">
          <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-400">
            LEVEL 1
          </span>

          <span className="text-xs text-gray-500">
            Problem 1
          </span>
        </div>

        <h2 className="text-2xl font-bold">
          Sum of Two Numbers
        </h2>

        <p className="mt-4 text-sm leading-7 text-gray-400">
          Write a program that reads two integers and prints
          their sum.
        </p>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">
            Input
          </h3>

          <p className="mt-2 rounded-lg bg-black/40 p-3 font-mono text-sm text-gray-400">
            Two integers A and B
          </p>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">
            Output
          </h3>

          <p className="mt-2 rounded-lg bg-black/40 p-3 font-mono text-sm text-gray-400">
            Print A + B
          </p>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">
            Example
          </h3>

          <div className="mt-2 rounded-lg bg-black/40 p-4 font-mono text-sm">
            <p className="text-gray-500">Input</p>
            <p>5 10</p>

            <p className="mt-3 text-gray-500">Output</p>
            <p>15</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <CodeEditor
        language={language}
        setLanguage={setLanguage}
        code={code}
        setCode={setCode}
        result={result}
        runCode={runCode}
        submitAnswer={submitAnswer}
        submitted={submitted}
      />
    </div>
  );
}

/* -------------------------------------------------------
   LEVEL 2
------------------------------------------------------- */

function Level2({ onComplete }) {
  const [code, setCode] = useState(
`# Write your Level 2 solution here

def solve():
    pass

solve()`
  );

  const [language, setLanguage] = useState("python");
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const runCode = () => {
    setResult("running");

    setTimeout(() => {
      setResult("success");
    }, 1200);
  };

  const submitAnswer = () => {
    if (!result || result === "running") return;

    setSubmitted(true);

    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-400">
          LEVEL 2
        </span>

        <h2 className="mt-6 text-2xl font-bold">
          Find the Maximum
        </h2>

        <p className="mt-4 text-sm leading-7 text-gray-400">
          Write a program that reads three integers and
          prints the largest number.
        </p>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">
            Example
          </h3>

          <div className="mt-2 rounded-lg bg-black/40 p-4 font-mono text-sm">
            <p className="text-gray-500">Input</p>
            <p>10 25 15</p>

            <p className="mt-3 text-gray-500">Output</p>
            <p>25</p>
          </div>
        </div>
      </div>

      <CodeEditor
        language={language}
        setLanguage={setLanguage}
        code={code}
        setCode={setCode}
        result={result}
        runCode={runCode}
        submitAnswer={submitAnswer}
        submitted={submitted}
      />
    </div>
  );
}

/* -------------------------------------------------------
   LEVEL 3
------------------------------------------------------- */

function Level3({ onComplete }) {
  const [code, setCode] = useState(
`# Write your Level 3 solution here

def solve():
    pass

solve()`
  );

  const [language, setLanguage] = useState("python");
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const runCode = () => {
    setResult("running");

    setTimeout(() => {
      setResult("success");
    }, 1200);
  };

  const submitAnswer = () => {
    if (!result || result === "running") return;

    setSubmitted(true);

    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <span className="rounded-full bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-400">
          LEVEL 3
        </span>

        <h2 className="mt-6 text-2xl font-bold">
          Array Processing
        </h2>

        <p className="mt-4 text-sm leading-7 text-gray-400">
          Read an array of integers and calculate the sum
          of all even numbers.
        </p>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">
            Example
          </h3>

          <div className="mt-2 rounded-lg bg-black/40 p-4 font-mono text-sm">
            <p className="text-gray-500">Input</p>
            <p>5</p>
            <p>1 2 3 4 6</p>

            <p className="mt-3 text-gray-500">Output</p>
            <p>12</p>
          </div>
        </div>
      </div>

      <CodeEditor
        language={language}
        setLanguage={setLanguage}
        code={code}
        setCode={setCode}
        result={result}
        runCode={runCode}
        submitAnswer={submitAnswer}
        submitted={submitted}
      />
    </div>
  );
}

/* -------------------------------------------------------
   CODE EDITOR
------------------------------------------------------- */

function CodeEditor({
  language,
  setLanguage,
  code,
  setCode,
  result,
  runCode,
  submitAnswer,
  submitted,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
      {/* Editor Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
        >
          <option value="c">C</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>

        <span className="text-xs text-gray-500">
          Your code is evaluated against test cases
        </span>
      </div>

      {/* Editor */}
      <div className="p-4">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="min-h-[480px] w-full resize-none rounded-xl border border-white/10 bg-[#050505] p-5 font-mono text-sm leading-6 text-gray-200 outline-none focus:border-cyan-400"
          onKeyDown={(e) => {
            // Keep TAB inside the editor for indentation.
            if (e.key === "Tab") {
              e.preventDefault();

              const start = e.target.selectionStart;
              const end = e.target.selectionEnd;

              const newValue =
                code.substring(0, start) +
                "    " +
                code.substring(end);

              setCode(newValue);

              requestAnimationFrame(() => {
                e.target.selectionStart = start + 4;
                e.target.selectionEnd = start + 4;
              });
            }

            // Prevent ESC
            if (e.key === "Escape") {
              e.preventDefault();
            }
          }}
        />
      </div>

      {/* Result */}
      <div className="border-t border-white/10 px-4 py-4">
        {!result && (
          <p className="text-sm text-gray-500">
            Run your code to check the test cases.
          </p>
        )}

        {result === "running" && (
          <div className="flex items-center gap-3 text-sm text-yellow-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            Running test cases...
          </div>
        )}

        {result === "success" && (
          <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-green-400">
              <span>✓</span>
              All test cases passed
            </div>

            <p className="mt-1 text-xs text-green-400/70">
              Your code produced the expected output.
            </p>
          </div>
        )}

        {result === "failed" && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-red-400">
              <span>✕</span>
              Test cases failed
            </div>

            <p className="mt-1 text-xs text-red-400/70">
              Your output did not match the expected output.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end">
        <button
          onClick={runCode}
          disabled={result === "running" || !code.trim()}
          className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {result === "running"
            ? "Running..."
            : "▶ Run Code"}
        </button>

        <button
          onClick={submitAnswer}
          disabled={
            !result ||
            result === "running" ||
            submitted
          }
          className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitted
            ? "Submitted"
            : "Submit Answer"}
        </button>
      </div>
    </div>
  );
}