import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import type { VaultDiagnosticsReport } from "../../features/vaultDiagnostics/buildVaultDiagnostics";
import { usePanelCollapse } from "../usePanelCollapse";

export default function DiagnosticsPanel({
  report,
  onOpenDoc
}: {
  report: VaultDiagnosticsReport;
  onOpenDoc: (docId: string) => void;
}) {
  const diagnosticsPanel = usePanelCollapse("marginalia-diagnostics");
  const visibleIssues = report.issues.slice(0, 12);
  const total = report.issues.length;

  return (
    <div id="marginalia-diagnostics" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div>
          <div className="font-display text-lg">Diagnostics</div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            {report.counts.error} errors / {report.counts.warning} warnings / {report.counts.info} notes
          </div>
        </div>
        <button
          onClick={diagnosticsPanel.toggle}
          aria-label={diagnosticsPanel.collapsed ? "Expand panel" : "Minimize panel"}
          className="text-ink-soft hover:text-ember"
        >
          {diagnosticsPanel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
        </button>
      </div>
      {!diagnosticsPanel.collapsed && (
        <div className="mt-3 space-y-2">
          {total === 0 ? (
            <p className="marginal-note">No vault issues found.</p>
          ) : (
            visibleIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => {
                  if (issue.docId) onOpenDoc(issue.docId);
                }}
                className="block w-full rounded-xl border border-page-edge bg-parchment/70 p-3 text-left hover:border-ember/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-display">{issue.title}</div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-ui uppercase tracking-[0.14em] ${
                      issue.severity === "error"
                        ? "bg-ember/15 text-ember"
                        : issue.severity === "warning"
                          ? "bg-accent-map/15 text-accent-map"
                          : "bg-parchment text-ink-soft"
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-soft">{issue.detail}</div>
              </button>
            ))
          )}
          {total > visibleIssues.length && (
            <p className="marginal-note">
              Showing {visibleIssues.length} of {total} issues.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
