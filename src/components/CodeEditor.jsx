import Editor from "@monaco-editor/react";
import { useCallback, useRef } from "react";

const MONACO_LANG = {
  python: "python",
  c: "c",
  java: "java",
};

/**
 * Monaco-based code editor for the exam.
 * TAB indents (does not move focus). Escape is blocked.
 * Other normal editing keys work as usual.
 */
export default function CodeEditor({
  language,
  code,
  onChange,
  readOnly = false,
}) {
  const editorRef = useRef(null);

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Monaco already uses Tab for indentation; block Escape only.
    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    editor.focus();
  }, []);

  return (
    <div className="h-[min(520px,55vh)] min-h-[360px] overflow-hidden rounded-xl border border-white/10">
      <Editor
        height="100%"
        theme="vs-dark"
        language={MONACO_LANG[language] || "python"}
        value={code}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleMount}
        options={{
          readOnly,
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: false,
          renderLineHighlight: "line",
          lineNumbers: "on",
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          // Reduce distracting IDE features in an exam setting
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          hover: { enabled: false },
          contextmenu: false,
          links: false,
          folding: false,
        }}
        loading={
          <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-sm text-gray-500">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
