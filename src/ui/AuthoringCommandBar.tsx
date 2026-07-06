import type { VaultDiagnosticsReport } from "../features/vaultDiagnostics/buildVaultDiagnostics";

type PageMode = "edit" | "preview" | "split";

export default function AuthoringCommandBar({
  mode,
  onModeChange,
  diagnosticsReport,
  templateCount,
  assetCount,
  onManageTemplates,
  onFocusMedia,
  onFocusDiagnostics
}: {
  mode: PageMode;
  onModeChange: (mode: PageMode) => void;
  diagnosticsReport: VaultDiagnosticsReport;
  templateCount: number;
  assetCount: number;
  onManageTemplates: () => void;
  onFocusMedia: () => void;
  onFocusDiagnostics: () => void;
}) {
  const diagnosticsLabel =
    diagnosticsReport.issues.length === 0
      ? "No diagnostics"
      : `${diagnosticsReport.issues.length} diagnostics`;

  return (
    <section
      id="authoring-command-bar"
      className="page-panel border-ember/20 bg-parchment/95 p-4"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-ui uppercase tracking-[0.24em] text-ember">
            Wiki Authoring Studio
          </div>
          <div className="mt-1 text-sm text-ink-soft">
            Split preview, page metadata, templates, diagnostics, inserts, and safe lore blocks.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-full border border-page-edge bg-parchment/80 p-1 text-xs font-ui uppercase tracking-[0.18em]"
            aria-label="Page authoring mode"
          >
            {(["edit", "preview", "split"] as const).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                onClick={() => onModeChange(nextMode)}
                className={`rounded-full px-3 py-1.5 ${
                  mode === nextMode
                    ? "bg-ember/15 text-ember"
                    : "text-ink-soft hover:text-ember"
                }`}
              >
                {nextMode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onManageTemplates}
            className="rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:border-ember/60 hover:text-ember"
          >
            Templates ({templateCount})
          </button>
          <button
            type="button"
            onClick={onFocusMedia}
            className="rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:border-ember/60 hover:text-ember"
          >
            Media ({assetCount})
          </button>
          <button
            type="button"
            onClick={onFocusDiagnostics}
            className={`rounded-full border px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] ${
              diagnosticsReport.counts.error > 0
                ? "border-ember/50 bg-ember/10 text-ember"
                : "border-page-edge bg-parchment/80 text-ink-soft hover:border-ember/60 hover:text-ember"
            }`}
          >
            {diagnosticsLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
