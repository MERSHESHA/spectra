import { useEffect, useState } from "react";
import {
  deleteAdminQuestion,
  deleteAdminTestCase,
  fetchAdminQuestions,
  saveAdminQuestion,
  saveAdminTestCase,
} from "../services/adminService";

const emptyQuestion = {
  id: "",
  level: 1,
  question_number: 1,
  title: "",
  description: "",
  input_format: "",
  output_format: "",
  constraints: "",
  marks: 10,
};

/**
 * Admin question + test-case manager (no redesign of overall admin chrome).
 */
export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [testForm, setTestForm] = useState({
    id: null,
    input: "",
    expected_output: "",
    is_hidden: false,
    sort_order: 0,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = questions.find((q) => q.id === selectedId) || null;

  const load = async () => {
    setError("");
    try {
      const list = await fetchAdminQuestions();
      setQuestions(list);
      if (selectedId && !list.some((q) => q.id === selectedId)) {
        setSelectedId(null);
        setForm(emptyQuestion);
      }
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectQuestion = (q) => {
    setSelectedId(q.id);
    setForm({
      id: q.id,
      level: q.level,
      question_number: q.question_number,
      title: q.title || "",
      description: q.description || "",
      input_format: q.input_format || "",
      output_format: q.output_format || "",
      constraints: q.constraints || "",
      marks: Number(q.marks) || 0,
    });
    setTestForm({
      id: null,
      input: "",
      expected_output: "",
      is_hidden: false,
      sort_order: (q.testCases?.length || 0) + 1,
    });
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm({ ...emptyQuestion, id: "" });
    setTestForm({
      id: null,
      input: "",
      expected_output: "",
      is_hidden: false,
      sort_order: 1,
    });
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.id) delete payload.id;
      const res = await saveAdminQuestion(payload);
      await load();
      if (res.question?.id) selectQuestion({ ...res.question, testCases: [] });
    } catch (err) {
      setError(err.message || "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!form.id) return;
    if (!window.confirm(`Delete question ${form.id}?`)) return;
    setSaving(true);
    try {
      await deleteAdminQuestion(form.id);
      setSelectedId(null);
      setForm(emptyQuestion);
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTestCase = async (e) => {
    e.preventDefault();
    if (!form.id) {
      setError("Save the question first, then add test cases.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveAdminTestCase({
        ...testForm,
        question_id: form.id,
      });
      setTestForm({
        id: null,
        input: "",
        expected_output: "",
        is_hidden: false,
        sort_order: (selected?.testCases?.length || 0) + 2,
      });
      await load();
    } catch (err) {
      setError(err.message || "Failed to save test case.");
    } finally {
      setSaving(false);
    }
  };

  const editTestCase = (tc) => {
    setTestForm({
      id: tc.id,
      input: tc.input || "",
      expected_output: tc.expected_output || "",
      is_hidden: Boolean(tc.is_hidden),
      sort_order: tc.sort_order ?? 0,
    });
  };

  const handleDeleteTestCase = async (id) => {
    if (!window.confirm("Delete this test case?")) return;
    setSaving(true);
    try {
      await deleteAdminTestCase(id);
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete test case.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Questions & Test Cases</h2>
          <p className="mt-1 text-sm text-gray-500">
            Changes apply immediately — no frontend rebuild required.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
        >
          Add Question
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="max-h-[70vh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => selectQuestion(q)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                selectedId === q.id
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "hover:bg-white/5 text-gray-300"
              }`}
            >
              <p className="font-medium">
                L{q.level}-Q{q.question_number}: {q.title}
              </p>
              <p className="text-[11px] text-gray-600">
                {q.marks} marks · {q.testCases?.length || 0} tests
              </p>
            </button>
          ))}
          {!questions.length && (
            <p className="p-3 text-sm text-gray-600">No questions yet.</p>
          )}
        </div>

        <div className="space-y-6">
          <form
            onSubmit={handleSaveQuestion}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h3 className="font-semibold">
              {form.id ? `Edit ${form.id}` : "New Question"}
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Level">
                <select
                  value={form.level}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, level: Number(e.target.value) }))
                  }
                  className="field"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </Field>
              <Field label="Question #">
                <input
                  type="number"
                  min={1}
                  value={form.question_number}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      question_number: Number(e.target.value),
                    }))
                  }
                  className="field"
                  required
                />
              </Field>
              <Field label="Marks">
                <input
                  type="number"
                  min={0}
                  value={form.marks}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, marks: Number(e.target.value) }))
                  }
                  className="field"
                  required
                />
              </Field>
            </div>

            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="field"
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="field"
                required
              />
            </Field>
            <Field label="Input Format">
              <textarea
                rows={2}
                value={form.input_format}
                onChange={(e) =>
                  setForm((f) => ({ ...f, input_format: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="Output Format">
              <textarea
                rows={2}
                value={form.output_format}
                onChange={(e) =>
                  setForm((f) => ({ ...f, output_format: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="Constraints">
              <textarea
                rows={2}
                value={form.constraints}
                onChange={(e) =>
                  setForm((f) => ({ ...f, constraints: e.target.value }))
                }
                className="field"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Question"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={handleDeleteQuestion}
                  disabled={saving}
                  className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300"
                >
                  Delete
                </button>
              )}
            </div>
          </form>

          {form.id && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold">Test Cases</h3>

              <ul className="space-y-2">
                {(selected?.testCases || []).map((tc, i) => (
                  <li
                    key={tc.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-black/30 p-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-400">
                        #{i + 1}{" "}
                        {tc.is_hidden ? (
                          <span className="text-orange-300">Hidden</span>
                        ) : (
                          <span className="text-green-300">Visible</span>
                        )}
                      </p>
                      <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-gray-300">
                        In: {tc.input}
                      </pre>
                      <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-gray-300">
                        Out: {tc.expected_output}
                      </pre>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => editTestCase(tc)}
                        className="text-cyan-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTestCase(tc.id)}
                        className="text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSaveTestCase} className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-sm text-gray-400">
                  {testForm.id ? "Edit test case" : "Add test case"}
                </p>
                <Field label="Input">
                  <textarea
                    rows={3}
                    value={testForm.input}
                    onChange={(e) =>
                      setTestForm((t) => ({ ...t, input: e.target.value }))
                    }
                    className="field font-mono"
                  />
                </Field>
                <Field label="Expected Output">
                  <textarea
                    rows={3}
                    value={testForm.expected_output}
                    onChange={(e) =>
                      setTestForm((t) => ({
                        ...t,
                        expected_output: e.target.value,
                      }))
                    }
                    className="field font-mono"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={testForm.is_hidden}
                      onChange={(e) =>
                        setTestForm((t) => ({
                          ...t,
                          is_hidden: e.target.checked,
                        }))
                      }
                    />
                    Hidden
                  </label>
                  <Field label="Sort">
                    <input
                      type="number"
                      value={testForm.sort_order}
                      onChange={(e) =>
                        setTestForm((t) => ({
                          ...t,
                          sort_order: Number(e.target.value),
                        }))
                      }
                      className="field w-24"
                    />
                  </Field>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {testForm.id ? "Update Test Case" : "Add Test Case"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.35);
          padding: 0.65rem 0.85rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
        }
        .field:focus { border-color: rgb(34 211 238); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-gray-400">{label}</span>
      {children}
    </label>
  );
}
