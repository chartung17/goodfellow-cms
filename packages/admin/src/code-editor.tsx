import type { Compartment, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { useDarkMode } from "./theme.js";

export type CodeLanguage = "css" | "html";

/** CodeMirror and its languages, loaded the first time a code editor is shown. */
async function loadCodeMirror(language: CodeLanguage) {
  const [{ basicSetup }, view, commands, state, highlighting, oneDark, languageSupport] = await Promise.all([
    import("codemirror"),
    import("@codemirror/view"),
    import("@codemirror/commands"),
    import("@codemirror/state"),
    import("@codemirror/language"),
    import("@codemirror/theme-one-dark"),
    language === "css"
      ? import("@codemirror/lang-css").then((m) => m.css())
      : import("@codemirror/lang-html").then((m) => m.html()),
  ]);
  // Code colors that read well on a dark background; light mode keeps the default ones.
  const darkColors = highlighting.syntaxHighlighting(oneDark.oneDarkHighlightStyle);
  return { basicSetup, view, commands, Compartment: state.Compartment, darkColors, languageSupport };
}

/** Colors and type from the admin panel's theme, so the editor follows its light and dark modes. */
function editorTheme(view: typeof import("@codemirror/view")) {
  return view.EditorView.theme({
    "&": {
      backgroundColor: "var(--gfa-surface)",
      color: "var(--gfa-text)",
      border: "1px solid var(--gfa-border)",
      borderRadius: "var(--gfa-radius)",
      fontSize: "13px",
    },
    "&.cm-focused": { outline: "2px solid var(--gfa-accent)", outlineOffset: "-1px" },
    ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.5" },
    ".cm-gutters": {
      backgroundColor: "var(--gfa-bg)",
      color: "var(--gfa-muted)",
      borderRight: "1px solid var(--gfa-border)",
    },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--gfa-code-active-line)" },
    ".cm-cursor": { borderLeftColor: "var(--gfa-text)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--gfa-code-selection) !important",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--gfa-surface)",
      color: "var(--gfa-text)",
      border: "1px solid var(--gfa-border)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--gfa-accent)",
      color: "var(--gfa-accent-text)",
    },
    ".cm-panels": { backgroundColor: "var(--gfa-bg)", color: "var(--gfa-text)" },
  });
}

/**
 * A code editor that works like a programmer's: it indents, closes brackets
 * and quotes, suggests CSS properties and values or HTML tags, and finds and
 * replaces (Ctrl+F). Tab indents; press Escape, then Tab, to move on. Until it
 * has loaded, it's a plain text box.
 */
export function CodeEditor({
  label,
  value,
  onChange,
  language,
  describedBy,
  minHeight = "24rem",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  describedBy?: string;
  minHeight?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | undefined>(undefined);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  // Set while the editor shows a value from outside, which isn't a change to report back.
  const replacing = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const dark = useDarkMode();
  const colors = useRef<{ compartment: Compartment; dark: Extension } | undefined>(undefined);
  const darkNow = useRef(dark);
  darkNow.current = dark;

  useEffect(() => {
    let cancelled = false;
    let created: EditorView | undefined;
    loadCodeMirror(language).then(
      ({ basicSetup, view, commands, Compartment, darkColors, languageSupport }) => {
        if (cancelled || !host.current) return;
        const compartment = new Compartment();
        colors.current = { compartment, dark: darkColors };
        created = new view.EditorView({
          parent: host.current,
          doc: latest.current.value,
          extensions: [
            basicSetup,
            languageSupport,
            compartment.of(darkNow.current ? darkColors : []),
            view.keymap.of([commands.indentWithTab]),
            editorTheme(view),
            view.EditorView.theme({ ".cm-content, .cm-gutter": { minHeight } }),
            view.EditorView.contentAttributes.of({
              "aria-label": label,
              ...(describedBy && { "aria-describedby": describedBy }),
            }),
            view.EditorView.updateListener.of((update) => {
              if (!update.docChanged || replacing.current) return;
              const text = update.state.doc.toString();
              if (text !== latest.current.value) latest.current.onChange(text);
            }),
          ],
        });
        editor.current = created;
        setReady(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      created?.destroy();
      editor.current = undefined;
      setReady(false);
    };
  }, [language, label, describedBy, minHeight]);

  // Switching between light and dark changes the code's colors.
  useEffect(() => {
    const view = editor.current;
    if (view && colors.current) {
      view.dispatch({ effects: colors.current.compartment.reconfigure(dark ? colors.current.dark : []) });
    }
  }, [dark]);

  // Changes made elsewhere, such as Undo above the form, replace what the editor shows.
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value) {
      replacing.current = true;
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      } finally {
        replacing.current = false;
      }
    }
  }, [value]);

  return (
    <div className="gfa-code-editor">
      <div ref={host} hidden={!ready} />
      {!ready && (
        <textarea
          className="gfa-input gfa-code"
          aria-label={label}
          aria-describedby={describedBy}
          spellCheck={false}
          style={{ minHeight }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-loading={failed ? undefined : ""}
        />
      )}
    </div>
  );
}
