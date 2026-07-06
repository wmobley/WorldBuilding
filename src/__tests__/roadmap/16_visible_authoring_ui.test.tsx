import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthoringCommandBar from "../../ui/AuthoringCommandBar";
import TemplateManagerModal from "../../ui/components/TemplateManagerModal";
import type { VaultDiagnosticsReport } from "../../features/vaultDiagnostics/buildVaultDiagnostics";
import type { PageTemplate } from "../../vault/types";

const emptyReport: VaultDiagnosticsReport = {
  counts: { error: 0, warning: 0, info: 0 },
  issues: []
};

describe("roadmap/16 visible authoring ui", () => {
  it("surfaces docs-style authoring controls above the page", async () => {
    const onModeChange = vi.fn();
    const onManageTemplates = vi.fn();
    const onFocusMedia = vi.fn();
    const onFocusDiagnostics = vi.fn();

    render(
      <AuthoringCommandBar
        mode="edit"
        onModeChange={onModeChange}
        diagnosticsReport={emptyReport}
        templateCount={7}
        assetCount={3}
        onManageTemplates={onManageTemplates}
        onFocusMedia={onFocusMedia}
        onFocusDiagnostics={onFocusDiagnostics}
      />
    );

    expect(screen.getByText("Wiki Authoring Studio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "split" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Templates (7)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Media (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No diagnostics" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "split" }));
    await userEvent.click(screen.getByRole("button", { name: "Templates (7)" }));
    await userEvent.click(screen.getByRole("button", { name: "Media (3)" }));
    await userEvent.click(screen.getByRole("button", { name: "No diagnostics" }));

    expect(onModeChange).toHaveBeenCalledWith("split");
    expect(onManageTemplates).toHaveBeenCalledTimes(1);
    expect(onFocusMedia).toHaveBeenCalledTimes(1);
    expect(onFocusDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("exposes template duplication in the manager", async () => {
    const template: PageTemplate = {
      id: "template-1",
      campaignId: "campaign-1",
      name: "Faction",
      description: "Faction page",
      kind: "faction",
      body: "# {{title}}",
      createdAt: 1,
      updatedAt: 1
    };
    const onDuplicate = vi.fn();

    render(
      <TemplateManagerModal
        isOpen
        templates={[template]}
        onClose={() => undefined}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDuplicate={onDuplicate}
        onDelete={() => undefined}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "Duplicate" }));

    expect(onDuplicate).toHaveBeenCalledWith(template);
  });
});
