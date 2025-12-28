import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  autocompletion,
  startCompletion,
  type Completion,
  type CompletionSource
} from "@codemirror/autocomplete";
import { minimalSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";

export type EditorHandle = {
  wrapSelection: (prefix: string, suffix: string) => void;
  openLinkMenu: () => void;
  prefixLines: (prefix: string) => void;
  wrapBlock: (prefix: string, suffix: string) => void;
  getSelection: () => { text: string; from: number; to: number } | null;
};

type LinkOption = {
  id: string;
  title: string;
  body: string;
  kind?: "doc" | "reference" | "folder";
  slug?: string;
};

const Editor = forwardRef<
  EditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    linkOptions: LinkOption[];
    onPreviewDoc: (docId: string) => void;
    onCursorLink: (target: string | null) => void;
    onMetaClickSelection?: (selection: { text: string; from: number; to: number }) => void;
  }
>(
  (
    { value, onChange, linkOptions, onPreviewDoc, onCursorLink, onMetaClickSelection },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const linkOptionsRef = useRef(linkOptions);
    const onPreviewRef = useRef(onPreviewDoc);
    const onCursorLinkRef = useRef(onCursorLink);
    const onMetaClickRef = useRef(onMetaClickSelection);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      linkOptionsRef.current = linkOptions;
    }, [linkOptions]);

    useEffect(() => {
      onPreviewRef.current = onPreviewDoc;
    }, [onPreviewDoc]);

    useEffect(() => {
      onCursorLinkRef.current = onCursorLink;
    }, [onCursorLink]);

    useEffect(() => {
      onMetaClickRef.current = onMetaClickSelection;
    }, [onMetaClickSelection]);

    useEffect(() => {
      if (!containerRef.current) return;
      if (viewRef.current) return;

      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      const primaryHeader = (doc: LinkOption) => {
        const sanitized = doc.body.replace(/<!--[\s\S]*?-->/g, "");
        const lines = sanitized.split("\n");
        for (const line of lines) {
          if (line.startsWith("# ")) {
            return line.slice(2).trim();
          }
        }
        return doc.title;
      };

      const matchesTitle = (title: string, query: string) => {
        const normalizedTitle = normalize(title);
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return true;
        if (normalizedTitle.startsWith(normalizedQuery)) return true;
        return normalizedTitle.includes(normalizedQuery);
      };

      const linkCompletionSource: CompletionSource = (context) => {
        const windowStart = Math.max(0, context.pos - 200);
        const before = context.state.doc.sliceString(windowStart, context.pos);
        const startIndex = before.lastIndexOf("[[");
        const endIndex = before.lastIndexOf("]]");
        if (startIndex === -1 || startIndex < endIndex) {
          console.debug("[WB] linkCompletionSource: no [[ context");
          return null;
        }
        const query = before.slice(startIndex + 2);
        if (query.includes("]]")) return null;

        const options: Completion[] = linkOptionsRef.current
          .map((doc) => ({
            doc,
            header: primaryHeader(doc)
          }))
          .filter((entry) => matchesTitle(entry.header, query))
          .slice(0, 50)
          .map((entry) => ({
            label: entry.header,
            detail:
              entry.doc.kind === "reference"
                ? "Reference"
                : entry.doc.kind === "folder"
                ? "Folder"
                : entry.doc.title,
            type: "link",
            apply: (view, completion, from, to) => {
              const target =
                entry.doc.kind === "reference"
                  ? `ref:${entry.doc.slug ?? "reference"}:${entry.doc.id}`
                  : entry.doc.kind === "folder"
                  ? `folder:${entry.doc.title}`
                  : `doc:${entry.doc.id}`;
              const insert =
                entry.doc.kind === "folder"
                  ? `${target}]]`
                  : `${target}|${entry.doc.title}]]`;
              view.dispatch({ changes: { from, to, insert } });
              if (entry.doc.kind !== "folder") {
                onPreviewRef.current(entry.doc.id);
              }
            }
          }));
        console.debug("[WB] linkCompletionSource", {
          query,
          options: options.length,
          sample: options.slice(0, 5).map((opt) => opt.label)
        });
        return {
          from: windowStart + startIndex + 2,
          options,
          filter: true,
          validFor: /[^\]\n]*/
        };
      };

      const extractLinkTargetAtCursor = (state: EditorState) => {
        const pos = state.selection.main.head;
        const windowStart = Math.max(0, pos - 300);
        const windowEnd = Math.min(state.doc.length, pos + 300);
        const slice = state.doc.sliceString(windowStart, windowEnd);
        const cursorIndex = pos - windowStart;
        const startIndex = slice.lastIndexOf("[[", cursorIndex);
        const endIndex = slice.indexOf("]]", cursorIndex);
        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
          return null;
        }
        const inner = slice.slice(startIndex + 2, endIndex);
        if (!inner.trim()) return null;
        return inner.trim();
      };

      const openLinkMenu = (view: EditorView) => {
        const { from, to } = view.state.selection.main;
        const before = view.state.doc.sliceString(Math.max(0, from - 2), from);
        if (before !== "[[") {
          view.dispatch({ changes: { from, to, insert: "[[" } });
        }
        startCompletion(view);
      };

      const state = EditorState.create({
        doc: value,
        extensions: [
          minimalSetup,
          markdown(),
          autocompletion({ override: [linkCompletionSource], activateOnTyping: true }),
          keymap.of([
            {
              key: "Mod-k",
              run: (view) => {
                openLinkMenu(view);
                return true;
              }
            }
          ]),
          EditorView.domEventHandlers({
            mousedown: (event, view) => {
              const mouseEvent = event as MouseEvent;
              if (!mouseEvent.metaKey && !mouseEvent.ctrlKey) return false;
              if (!onMetaClickRef.current) return false;
              const coords = { x: mouseEvent.clientX, y: mouseEvent.clientY };
              const pos = view.posAtCoords(coords);
              if (pos == null) return false;
              const selection = view.state.selection.main;
              let from = selection.from;
              let to = selection.to;
              if (from === to) {
                const line = view.state.doc.lineAt(pos);
                const offset = pos - line.from;
                const text = line.text;
                const expandBetween = (open: string, close: string) => {
                  const before = text.lastIndexOf(open, offset);
                  const after =
                    offset <= text.length ? text.indexOf(close, offset) : -1;
                  if (before === -1 || after === -1 || before >= after) {
                    return null;
                  }
                  return {
                    start: before + open.length,
                    end: after
                  };
                };
                const boldSpan = expandBetween("**", "**");
                const italicSpan = boldSpan ? null : expandBetween("*", "*");
                const span = boldSpan ?? italicSpan;
                if (span && span.start !== span.end) {
                  from = line.from + span.start;
                  to = line.from + span.end;
                } else {
                  const isWordChar = (char: string) =>
                    /[A-Za-z0-9'_-]/.test(char);
                  let start = offset;
                  let end = offset;
                  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
                  while (end < text.length && isWordChar(text[end])) end += 1;
                  if (start === end) return false;
                  from = line.from + start;
                  to = line.from + end;
                }
              }
              const selectedText = view.state.doc.sliceString(from, to);
              if (!selectedText.trim()) return false;
              mouseEvent.preventDefault();
              onMetaClickRef.current({
                text: selectedText,
                from,
                to
              });
              return true;
            }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
              const cursor = update.state.selection.main.head;
              if (cursor >= 2) {
                const recent = update.state.doc.sliceString(cursor - 2, cursor);
                if (recent === "[[") {
                  console.debug("[WB] trigger completion on [[");
                  startCompletion(update.view);
                }
              }
            }
            if (update.selectionSet || update.docChanged) {
              const target = extractLinkTargetAtCursor(update.state);
              onCursorLinkRef.current(target);
            }
          })
        ]
      });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current
      });

      return () => {
        viewRef.current?.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentValue = view.state.doc.toString();
      if (currentValue === value) return;
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value }
      });
    }, [value]);

    const wrapSelection = (prefix: string, suffix: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      const insert = `${prefix}${selected}${suffix}`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + prefix.length, head: from + insert.length - suffix.length }
      });
      view.focus();
    };

    const wrapBlock = (prefix: string, suffix: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      const insert = `${prefix}${selected}${suffix}`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + prefix.length, head: from + insert.length - suffix.length }
      });
      view.focus();
    };

    const prefixLines = (prefix: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const startLine = view.state.doc.lineAt(from).number;
      const endLine = view.state.doc.lineAt(to).number;
      const changes = [];
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
        const line = view.state.doc.line(lineNumber);
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
      view.dispatch({ changes });
      view.focus();
    };

    const openLinkMenu = () => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const before = view.state.doc.sliceString(Math.max(0, from - 2), from);
      if (before !== "[[") {
        view.dispatch({ changes: { from, to, insert: "[[" } });
      }
      startCompletion(view);
      view.focus();
    };

    const getSelection = () => {
      const view = viewRef.current;
      if (!view) return null;
      const { from, to } = view.state.selection.main;
      const text = view.state.doc.sliceString(from, to);
      return { text, from, to };
    };

    useImperativeHandle(ref, () => ({
      wrapSelection,
      openLinkMenu,
      prefixLines,
      wrapBlock,
      getSelection
    }));

    return <div id="editor-codemirror" ref={containerRef} className="codemirror-shell" />;
  }
);

Editor.displayName = "Editor";

export default Editor;
