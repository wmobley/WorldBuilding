import { useMemo, useState } from "react";
import type { Doc } from "../vault/types";

export default function QuickOpen({
  docs,
  isOpen,
  onClose,
  onOpenDoc
}: {
  docs: Doc[];
  isOpen: boolean;
  onClose: () => void;
  onOpenDoc: (docId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const lower = query.toLowerCase();
    return docs
      .filter((doc) => doc.title.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [docs, query]);

  if (!isOpen) return null;

  return (
    <div
      id="quick-open"
      className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="page-panel w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg">Quick Open</div>
          <button
            onClick={() => {
              onClose();
              setQuery("");
            }}
            id="quick-open-close"
            className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft wb-tooltip"
            data-tooltip="Close quick open"
          >
            Close
          </button>
        </div>
        <label
          htmlFor="quick-open-input"
          className="mt-4 block text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
          data-tooltip="Type to filter pages by title."
        >
          Search Pages
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a page title…"
            id="quick-open-input"
            className="mt-2 w-full rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-ui"
          />
        </label>
        <div className="mt-4 space-y-2">
          {matches.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                onOpenDoc(doc.id);
                setQuery("");
                onClose();
              }}
              className="block w-full text-left rounded-xl border border-page-edge px-4 py-2 text-sm hover:border-ember wb-tooltip"
              data-tooltip={`Open ${doc.title}`}
            >
              {doc.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
