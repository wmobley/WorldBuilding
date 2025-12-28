import type { PrepHelpers } from "../../prep/helpers";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";

const formatJson = (payload: unknown) => JSON.stringify(payload, null, 2);

export default function PrepPanel({ prepHelpers }: { prepHelpers: PrepHelpers | null }) {
  const panel = usePanelCollapse("marginalia-prep");

  return (
    <div id="marginalia-prep" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Prep Helpers</div>
        <button
          onClick={panel.toggle}
          aria-label={panel.collapsed ? "Expand panel" : "Minimize panel"}
          className="text-ink-soft hover:text-ember"
        >
          {panel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
        </button>
      </div>
      {!panel.collapsed && (
        <div className="space-y-4">
          {!prepHelpers && (
            <p className="text-xs text-ink-soft">Open a page to generate prep helpers.</p>
          )}
          {prepHelpers && (
            <>
              <section className="space-y-2">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  Suggest Encounter
                </div>
                <pre className="rounded-xl border border-page-edge bg-parchment/80 p-3 text-[11px] font-mono leading-relaxed text-ink max-h-64 overflow-auto">
                  {formatJson(prepHelpers.suggestEncounter)}
                </pre>
              </section>
              <section className="space-y-2">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  Who&apos;s Involved
                </div>
                <pre className="rounded-xl border border-page-edge bg-parchment/80 p-3 text-[11px] font-mono leading-relaxed text-ink max-h-64 overflow-auto">
                  {formatJson(prepHelpers.whosInvolved)}
                </pre>
              </section>
              <section className="space-y-2">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  What Changed Recently
                </div>
                <pre className="rounded-xl border border-page-edge bg-parchment/80 p-3 text-[11px] font-mono leading-relaxed text-ink max-h-64 overflow-auto">
                  {formatJson(prepHelpers.whatChangedRecently)}
                </pre>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
