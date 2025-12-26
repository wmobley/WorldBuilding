import type { Doc, Tag } from "../../vault/types";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";

export default function TagsPanel({
  tags,
  activeTag,
  filteredDocs,
  onFilterTag,
  onClearFilter,
  onOpenDoc
}: {
  tags: Tag[];
  activeTag: { type: string; value: string } | null;
  filteredDocs: Doc[];
  onFilterTag: (type: string, value: string) => void;
  onClearFilter: () => void;
  onOpenDoc: (docId: string) => void;
}) {
  const panel = usePanelCollapse("marginalia-tags");

  return (
    <div id="marginalia-tags" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Context Tags</div>
        <button
          onClick={panel.toggle}
          aria-label={panel.collapsed ? "Expand panel" : "Minimize panel"}
          className="text-ink-soft hover:text-ember"
        >
          {panel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
        </button>
      </div>
      {!panel.collapsed && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.length === 0 && (
              <p className="marginal-note">No tags parsed on this page yet.</p>
            )}
            {tags.map((tag) => (
              <button
                key={`${tag.type}:${tag.value}`}
                onClick={() => onFilterTag(tag.type, tag.value)}
                data-tooltip={`Filter by @${tag.type}:${tag.value}`}
                className="rounded-full border border-page-edge px-3 py-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
              >
                @{tag.type}:{tag.value}
              </button>
            ))}
          </div>
          {activeTag && (
            <div
              id="marginalia-tag-filter"
              className="mt-4 border-t border-page-edge pt-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                  @{activeTag.type}:{activeTag.value}
                </div>
                <button
                  onClick={onClearFilter}
                  data-tooltip="Clear tag filter"
                  className="text-[11px] text-ink-soft hover:text-ember wb-tooltip"
                >
                  Clear
                </button>
              </div>
              {filteredDocs.length === 0 ? (
                <p className="marginal-note">No pages share this context.</p>
              ) : (
                filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => onOpenDoc(doc.id)}
                    data-tooltip={`Open ${doc.title}`}
                    className="block w-full text-left rounded-xl border border-page-edge px-3 py-2 text-sm hover:border-ember wb-tooltip"
                  >
                    {doc.title}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
