import type { EncounterSuggestion } from "../../prep/helpers/suggestEncounter";
import type { InvolvedEntity } from "../../prep/helpers/whoIsInvolved";
import type { RecentChange } from "../../prep/helpers/whatChangedRecently";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";

function formatEncounterSeed(entry: EncounterSuggestion) {
  const creatures = entry.creatureTags.length > 0 ? entry.creatureTags.join(", ") : "Unspecified";
  const factions = entry.factions.length > 0 ? entry.factions.join(", ") : "None noted";
  const figures = entry.figures.length > 0 ? entry.figures.join(", ") : "None noted";
  return [
    "### Encounter Seed",
    `- Environment: ${entry.environment}`,
    `- Creatures: ${creatures}`,
    `- Factions: ${factions}`,
    `- Figures: ${figures}`,
    `- Why: ${entry.reason}`
  ].join("\n");
}

function formatInvolvedList(entries: InvolvedEntity[]) {
  if (entries.length === 0) return "### Who's Involved Here?\n- None noted yet.";
  return [
    "### Who's Involved Here?",
    ...entries.map(
      (entry) =>
        `- ${entry.name} (${entry.type}, relevance ${entry.relevance}): ${entry.reason}`
    )
  ].join("\n");
}

function formatRecentChanges(entries: RecentChange[]) {
  if (entries.length === 0) return "### What Changed Recently?\n- None noted yet.";
  return [
    "### What Changed Recently?",
    ...entries.map((entry) => {
      const impacted =
        entry.impactedEntities.length > 0
          ? entry.impactedEntities.join(", ")
          : "None noted";
      return `- ${entry.docTitle} (${entry.lastUpdated}) | Impacted: ${impacted} | Why: ${entry.reason}`;
    })
  ].join("\n");
}

export default function PrepPanel({
  prepEncounters,
  prepInvolved,
  prepChanges,
  prepLoading,
  onRunSuggestEncounter,
  onRunWhoIsInvolved,
  onRunWhatChangedRecently,
  onInsertPrepContent
}: {
  prepEncounters: EncounterSuggestion[];
  prepInvolved: InvolvedEntity[];
  prepChanges: RecentChange[];
  prepLoading: { encounters: boolean; involved: boolean; changes: boolean };
  onRunSuggestEncounter: () => void;
  onRunWhoIsInvolved: () => void;
  onRunWhatChangedRecently: () => void;
  onInsertPrepContent: (content: string) => void;
}) {
  const panel = usePanelCollapse("marginalia-prep");

  return (
    <div id="marginalia-prep" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Prep</div>
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
          <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em]">
            <button
              onClick={onRunSuggestEncounter}
              disabled={prepLoading.encounters}
              className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prepLoading.encounters ? "Loading..." : "Suggest Encounter"}
            </button>
            <button
              onClick={onRunWhoIsInvolved}
              disabled={prepLoading.involved}
              className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prepLoading.involved ? "Loading..." : "Who's Involved Here?"}
            </button>
            <button
              onClick={onRunWhatChangedRecently}
              disabled={prepLoading.changes}
              className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prepLoading.changes ? "Loading..." : "What Changed Recently?"}
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                <span>Encounter Seeds</span>
                {prepEncounters.length > 0 && (
                  <button
                    onClick={() =>
                      onInsertPrepContent(prepEncounters.map(formatEncounterSeed).join("\n\n"))
                    }
                    className="text-[11px] text-ink-soft hover:text-ember"
                  >
                    Insert All
                  </button>
                )}
              </div>
              {prepEncounters.length === 0 ? (
                <p className="marginal-note">Run "Suggest Encounter" to surface seeds.</p>
              ) : (
                prepEncounters.map((entry, index) => (
                  <div
                    key={`${entry.environment}-${index}`}
                    className="rounded-2xl border border-page-edge bg-parchment/70 p-3 space-y-2"
                  >
                    <div className="text-sm font-display">{entry.environment}</div>
                    <div className="text-xs text-ink-soft">
                      Creatures:{" "}
                      {entry.creatureTags.length > 0
                        ? entry.creatureTags.join(", ")
                        : "Unspecified"}
                    </div>
                    <div className="text-xs text-ink-soft">
                      Factions: {entry.factions.length > 0 ? entry.factions.join(", ") : "None"}
                    </div>
                    <div className="text-xs text-ink-soft">
                      Figures: {entry.figures.length > 0 ? entry.figures.join(", ") : "None"}
                    </div>
                    <div className="marginal-note">Why: {entry.reason}</div>
                    <button
                      onClick={() => onInsertPrepContent(formatEncounterSeed(entry))}
                      className="text-[11px] text-ink-soft hover:text-ember"
                    >
                      Insert into Page
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                <span>Who's Involved</span>
                {prepInvolved.length > 0 && (
                  <button
                    onClick={() => onInsertPrepContent(formatInvolvedList(prepInvolved))}
                    className="text-[11px] text-ink-soft hover:text-ember"
                  >
                    Insert All
                  </button>
                )}
              </div>
              {prepInvolved.length === 0 ? (
                <p className="marginal-note">
                  Run "Who's Involved Here?" to list key actors.
                </p>
              ) : (
                prepInvolved.map((entry) => (
                  <div
                    key={`${entry.type}-${entry.name}`}
                    className="rounded-2xl border border-page-edge bg-parchment/70 p-3 space-y-2"
                  >
                    <div className="text-sm font-display">{entry.name}</div>
                    <div className="text-xs text-ink-soft">
                      {entry.type} · relevance {entry.relevance}
                    </div>
                    <div className="marginal-note">Why: {entry.reason}</div>
                    <button
                      onClick={() =>
                        onInsertPrepContent(
                          `### ${entry.name}\n- Type: ${entry.type}\n- Relevance: ${entry.relevance}\n- Why: ${entry.reason}`
                        )
                      }
                      className="text-[11px] text-ink-soft hover:text-ember"
                    >
                      Insert into Page
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                <span>Recent Changes</span>
                {prepChanges.length > 0 && (
                  <button
                    onClick={() => onInsertPrepContent(formatRecentChanges(prepChanges))}
                    className="text-[11px] text-ink-soft hover:text-ember"
                  >
                    Insert All
                  </button>
                )}
              </div>
              {prepChanges.length === 0 ? (
                <p className="marginal-note">Run "What Changed Recently?" to scan updates.</p>
              ) : (
                prepChanges.map((entry) => (
                  <div
                    key={entry.docTitle}
                    className="rounded-2xl border border-page-edge bg-parchment/70 p-3 space-y-2"
                  >
                    <div className="text-sm font-display">{entry.docTitle}</div>
                    <div className="text-xs text-ink-soft">
                      Last updated: {entry.lastUpdated}
                    </div>
                    <div className="text-xs text-ink-soft">
                      Impacted:{" "}
                      {entry.impactedEntities.length > 0
                        ? entry.impactedEntities.join(", ")
                        : "None noted"}
                    </div>
                    <div className="marginal-note">Why: {entry.reason}</div>
                    <button
                      onClick={() =>
                        onInsertPrepContent(
                          `### ${entry.docTitle}\n- Last updated: ${entry.lastUpdated}\n- Impacted: ${
                            entry.impactedEntities.length > 0
                              ? entry.impactedEntities.join(", ")
                              : "None noted"
                          }\n- Why: ${entry.reason}`
                        )
                      }
                      className="text-[11px] text-ink-soft hover:text-ember"
                    >
                      Insert into Page
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
