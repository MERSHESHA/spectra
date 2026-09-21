/**
 * Admin-only evaluation criteria (marks + ranking rules).
 * Never rendered on student pages.
 */
export default function EvaluationCriteria({ criteria }) {
  if (!criteria) {
    return (
      <p className="text-sm text-gray-500">Loading evaluation criteria…</p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Evaluation Criteria</h2>
        <p className="mt-2 text-sm text-gray-500">
          Visible to admins only. Students never see marks or ranking.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {criteria.levels.map((level) => (
          <div
            key={level.level}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
              Level {level.level}
            </p>
            <p className="mt-2 text-2xl font-bold">{level.totalMarks} marks</p>
            <p className="mt-1 text-sm text-gray-500">
              {level.questionCount} question
              {level.questionCount === 1 ? "" : "s"}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-gray-300">
              {level.questions.map((q) => (
                <li key={q.number} className="flex justify-between">
                  <span>Q{q.number}</span>
                  <span className="font-mono text-cyan-300">{q.marks}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold">Total exam marks</p>
        <p className="mt-2 text-3xl font-bold text-cyan-400">
          {criteria.totalMarks}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="font-semibold">Scoring formula</h3>
        <p className="mt-3 font-mono text-sm text-gray-300">
          {criteria.scoringFormula}
        </p>
        <div className="mt-4 space-y-2 text-sm text-gray-400">
          <p>Example (10-mark question, 8/10 tests passed): 8/10 × 10 = 8</p>
          <p>Example (15-mark question, 8/10 tests passed): 8/10 × 15 = 12</p>
          <p>Example (40-mark question, 8/10 tests passed): 8/10 × 40 = 32</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="font-semibold">Ranking criteria</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-400">
          {criteria.ranking.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
