/**
 * Displays per-test-case pass/fail only.
 * Never shows marks, scores, or totals.
 */
export default function TestResults({ status, message, results }) {
  if (!status) {
    return (
      <p className="text-sm text-gray-500">
        Run your code to check the test cases.
      </p>
    );
  }

  if (status === "running") {
    return (
      <div className="flex items-center gap-3 text-sm text-yellow-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
        Running…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
        <p className="font-semibold text-red-400">Execution error</p>
        <p className="mt-1 text-xs text-red-400/80">
          {message || "Something went wrong while running your code."}
        </p>
      </div>
    );
  }

  if (status === "compile_error") {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
        <p className="font-semibold text-red-400">Compilation error</p>
        {message && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-red-300/90">
            {message}
          </pre>
        )}
      </div>
    );
  }

  if (!results?.length) {
    return (
      <p className="text-sm text-gray-500">No test case results returned.</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-xs text-gray-500">
        {results.length} test case{results.length === 1 ? "" : "s"}
      </p>

      <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {results.map((result, index) => {
          const label = `Test Case ${result.id ?? index + 1}`;
          const passed = result.status === "passed";
          const failed = result.status === "failed";

          let statusLabel = "Error";
          let color = "text-red-400";
          let icon = "✕";

          if (passed) {
            statusLabel = "Passed";
            color = "text-green-400";
            icon = "✓";
          } else if (failed) {
            statusLabel = "Failed";
            color = "text-red-400";
            icon = "✕";
          } else if (result.status === "timeout") {
            statusLabel = "Timeout";
            color = "text-orange-400";
            icon = "✕";
          } else if (result.status === "runtime_error") {
            statusLabel = "Runtime Error";
            color = "text-red-400";
            icon = "✕";
          }

          return (
            <li
              key={result.id ?? index}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm"
            >
              <span className="text-gray-300">{label}</span>
              <span className={`flex items-center gap-1.5 font-medium ${color}`}>
                <span aria-hidden>{icon}</span>
                {statusLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
