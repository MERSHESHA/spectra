import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";

const MONACO_LANG = {
  python: "python",
  c: "c",
  java: "java",
};

/**
 * Monaco exam editor.
 * - Escape blocked
 * - Ctrl/Cmd+C / V / X blocked
 * - Tab indents for Python (and stays in editor for all languages)
 */
export default function CodeEditor({
  language,
  code,
  onChange,
  readOnly = false,
}) {
  const editorRef = useRef(null);
  const languageRef = useRef(language);
  languageRef.current = language;

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Escape) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod) {
        const key = e.browserEvent?.key?.toLowerCase?.() || "";
        if (key === "c" || key === "v" || key === "x") {
          e.preventDefault();
          e.stopPropagation();
        }
      }

      // Keep Tab inside the editor (indent). Required especially for Python.
      if (e.keyCode === monaco.KeyCode.Tab) {
        // Let Monaco handle indent; just stop focus leaving the page.
        e.browserEvent?.stopPropagation?.();
      }
    });

    // Extra DOM-level block for copy/paste on the editor DOM node
    const dom = editor.getDomNode();
    if (dom) {
      const blockClipboard = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      dom.addEventListener("copy", blockClipboard, true);
      dom.addEventListener("cut", blockClipboard, true);
      dom.addEventListener("paste", blockClipboard, true);
    }

    editor.focus();
  }, []);

  useEffect(() => {
    const block = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key?.toLowerCase?.();
      if (key !== "c" && key !== "v" && key !== "x") return;
      // Only block when focus is inside Monaco
      const dom = editorRef.current?.getDomNode?.();
      if (dom && (dom === e.target || dom.contains(e.target))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
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
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          hover: { enabled: false },
          contextmenu: false,
          links: false,
          folding: false,
          // Tab always indents in editor (critical for Python)
          tabCompletion: "off",
          useTabStops: true,
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
