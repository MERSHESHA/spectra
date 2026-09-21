/**
 * Renders question text from the shared config.
 * Never displays marks / scores.
 */
export default function QuestionPanel({ level, question, questionNumber, totalInLevel }) {
  if (!question) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            level === 1
              ? "bg-cyan-400/10 text-cyan-400"
              : level === 2
              ? "bg-purple-400/10 text-purple-400"
              : "bg-orange-400/10 text-orange-400"
          }`}
        >
          LEVEL {level}
        </span>

        <span className="text-xs text-gray-500">
          Question {questionNumber} of {totalInLevel}
        </span>
      </div>

      <h2 className="text-2xl font-bold">{question.title}</h2>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-400">
        {question.description}
      </p>

      {question.inputFormat && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Input</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-sm text-gray-400">
            {question.inputFormat}
          </p>
        </div>
      )}

      {question.outputFormat && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Output</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-sm text-gray-400">
            {question.outputFormat}
          </p>
        </div>
      )}

      {question.constraints && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Constraints</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-sm text-gray-400">
            {question.constraints}
          </p>
        </div>
      )}

      {question.examples?.length > 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold">
            {question.examples.length === 1 ? "Example" : "Examples"}
          </h3>

          {question.examples.map((example, index) => (
            <div
              key={index}
              className="rounded-lg bg-black/40 p-4 font-mono text-sm"
            >
              {question.examples.length > 1 && (
                <p className="mb-2 text-xs text-gray-600">
                  Example {index + 1}
                </p>
              )}
              <p className="text-gray-500">Input</p>
              <pre className="mt-1 whitespace-pre-wrap text-gray-200">
                {example.input}
              </pre>
              <p className="mt-3 text-gray-500">Output</p>
              <pre className="mt-1 whitespace-pre-wrap text-gray-200">
                {example.output}
              </pre>
              {example.explanation && (
                <>
                  <p className="mt-3 text-gray-500">Explanation</p>
                  <p className="mt-1 text-gray-400">{example.explanation}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
