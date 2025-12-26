import type { Doc } from "../../vault/types";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";

export default function BacklinksPanel({
  backlinks,
  onOpenDoc
}: {
  backlinks: Array<{
    source: Doc;
    heading: string | null;
    subheading: string | null;
    line: string;
  }>;
  onOpenDoc: (docId: string) => void;
}) {
  const panel = usePanelCollapse("marginalia-backlinks");

  return (
    <div id="marginalia-backlinks" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Marginalia</div>
        <button
          onClick={panel.toggle}
          aria-label={panel.collapsed ? "Expand panel" : "Minimize panel"}
          className="text-ink-soft hover:text-ember"
        >
          {panel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
        </button>
      </div>
      {!panel.collapsed && (
        <div className="mt-3 space-y-3">
          {backlinks.length === 0 && (
            <p className="marginal-note">No backlinks yet. Let this page echo elsewhere.</p>
          )}
          {backlinks.map((entry, index) => (
            <button
              key={`${entry.source.id}-${index}`}
              onClick={() => onOpenDoc(entry.source.id)}
              data-tooltip={`Open ${entry.source.title}`}
              className="block text-left w-full rounded-xl border border-page-edge p-3 hover:border-ember wb-tooltip"
            >
              <div className="text-sm font-display">{entry.source.title}</div>
              {entry.heading && (
                <div className="mt-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  {entry.heading}
                </div>
              )}
              {entry.subheading && (
                <div className="text-xs font-ui uppercase tracking-[0.16em] text-ink-soft">
                  {entry.subheading}
                </div>
              )}
              {entry.line && <div className="marginal-note mt-2">{entry.line}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
