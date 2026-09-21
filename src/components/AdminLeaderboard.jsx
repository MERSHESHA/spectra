/**
 * Admin leaderboard table.
 */
export default function AdminLeaderboard({ rows, onSelect, selectedId }) {
  if (!rows?.length) {
    return (
      <p className="text-sm text-gray-500">No student results yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Register No</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Dept</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">L1</th>
            <th className="px-4 py-3">L2</th>
            <th className="px-4 py-3">L3</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.studentId}
              onClick={() => onSelect?.(row)}
              className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${
                selectedId === row.studentId ? "bg-cyan-400/10" : ""
              }`}
            >
              <td className="px-4 py-3 font-mono font-semibold text-cyan-300">
                {row.rank}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {row.registerNumber}
              </td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-gray-400">{row.department}</td>
              <td className="px-4 py-3 text-gray-400">{row.year}</td>
              <td className="px-4 py-3 font-mono">{row.level1}</td>
              <td className="px-4 py-3 font-mono">{row.level2}</td>
              <td className="px-4 py-3 font-mono">{row.level3}</td>
              <td className="px-4 py-3 font-mono font-bold text-cyan-300">
                {row.totalScore}
              </td>
              <td className="px-4 py-3 font-mono text-gray-400">
                {row.completionTime}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    completed: "bg-green-400/15 text-green-400",
    in_progress: "bg-cyan-400/15 text-cyan-300",
    time_expired: "bg-orange-400/15 text-orange-300",
    not_started: "bg-white/10 text-gray-400",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        map[status] || map.not_started
      }`}
    >
      {status?.replace("_", " ") || "—"}
    </span>
  );
}
