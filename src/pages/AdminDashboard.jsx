import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLeaderboard from "../components/AdminLeaderboard";
import EvaluationCriteria from "../components/EvaluationCriteria";
import {
  clearAdminSession,
  fetchEvaluationCriteria,
  fetchLeaderboard,
  fetchOverview,
  fetchStudentDetail,
  getAdminUsername,
  verifyAdminSession,
} from "../services/adminService";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "criteria", label: "Evaluation Criteria" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [criteria, setCriteria] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const username = getAdminUsername();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await verifyAdminSession();
      if (cancelled) return;
      if (!session) {
        navigate("/admin", { replace: true });
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, lb, cr] = await Promise.all([
        fetchOverview(),
        fetchLeaderboard(),
        fetchEvaluationCriteria(),
      ]);
      setOverview(ov);
      setLeaderboard(lb);
      setCriteria(cr);
    } catch (err) {
      if (err.status === 401) {
        navigate("/admin", { replace: true });
        return;
      }
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!ready) return undefined;
    refresh();
    // Soft refresh every 60s — not continuous polling
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [ready, refresh]);

  const handleSelect = async (row) => {
    setSelectedId(row.studentId);
    setTab("leaderboard");
    try {
      const data = await fetchStudentDetail(row.studentId);
      setDetail(data);
    } catch (err) {
      setError(err.message || "Failed to load student.");
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    navigate("/admin", { replace: true });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-gray-500">
        Verifying admin session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-[#050505]/95">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              CODE<span className="text-cyan-400">X</span>{" "}
              <span className="text-sm font-medium text-gray-500">Admin</span>
            </h1>
            <p className="text-xs text-gray-600">Signed in as {username}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-cyan-400 text-black"
                  : "border border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {tab === "overview" && overview && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Total Students" value={overview.totalStudents} />
            <Stat label="Started" value={overview.started} />
            <Stat label="In Progress" value={overview.inProgress} />
            <Stat label="Completed" value={overview.completed} />
            <Stat label="Time Expired" value={overview.timeExpired} />
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div>
              <h2 className="mb-4 text-xl font-bold">Leaderboard</h2>
              <AdminLeaderboard
                rows={leaderboard}
                onSelect={handleSelect}
                selectedId={selectedId}
              />
            </div>
            <StudentDetailPanel detail={detail} />
          </div>
        )}

        {tab === "criteria" && <EvaluationCriteria criteria={criteria} />}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-cyan-300">{value ?? "—"}</p>
    </div>
  );
}

function StudentDetailPanel({ detail }) {
  if (!detail) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-500">
        Click a student in the leaderboard to view details, scores, and
        evaluation breakdown.
      </div>
    );
  }

  const { student, result, levels } = detail;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div>
        <h3 className="text-lg font-bold">{student.name}</h3>
        <p className="mt-1 font-mono text-xs text-gray-500">
          {student.registerNumber}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {student.department} · Year {student.year}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Status" value={student.status} />
        <Info
          label="Total"
          value={result ? `${result.totalScore}` : "0"}
        />
        <Info
          label="Time"
          value={result?.completionTime || "—"}
        />
        <Info
          label="L1 / L2 / L3"
          value={
            result
              ? `${result.level1Score} / ${result.level2Score} / ${result.level3Score}`
              : "—"
          }
        />
      </div>

      <p className="text-xs text-gray-600">
        Started: {formatTs(student.examStartedAt)}
        <br />
        Ended: {formatTs(student.examEndedAt)}
      </p>

      {[1, 2, 3].map((level) => (
        <div key={level}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">
            Level {level}
          </p>
          <div className="space-y-2">
            {(levels[level] || []).map((q) => (
              <div
                key={q.questionId}
                className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-200">
                    Q{q.questionNumber}. {q.title}
                  </p>
                  <span className="shrink-0 font-mono text-cyan-300">
                    {q.isSubmitted ? `${q.score}/${q.marks}` : "—"}
                  </span>
                </div>
                {q.isSubmitted ? (
                  <p className="mt-2 text-gray-500">
                    {q.language} · {q.passedTestCases}/{q.totalTestCases} tests
                    · {q.status}
                  </p>
                ) : (
                  <p className="mt-2 text-gray-600">Not submitted</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase text-gray-600">{label}</p>
      <p className="mt-0.5 font-medium capitalize">{value}</p>
    </div>
  );
}

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
