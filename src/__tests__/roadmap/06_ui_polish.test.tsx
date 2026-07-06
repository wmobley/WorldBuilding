import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TagsPanel from "../../ui/marginalia/TagsPanel";
import BacklinksPanel from "../../ui/marginalia/BacklinksPanel";
import PrepPanel from "../../ui/marginalia/PrepPanel";

vi.mock("../../lib/supabase", () => ({
  supabase: {}
}));

describe("roadmap/06 ui polish - empty states", () => {
  it("shows empty-state messaging for tags and backlinks", () => {
    render(
      <div>
        <TagsPanel
          tags={[]}
          activeTag={null}
          filteredDocs={[]}
          onFilterTag={() => undefined}
          onClearFilter={() => undefined}
          onOpenDoc={() => undefined}
        />
        <BacklinksPanel backlinks={[]} onOpenDoc={() => undefined} />
      </div>
    );

    expect(screen.getByText("No tags parsed on this page yet.")).toBeInTheDocument();
    expect(
      screen.getByText("No backlinks yet. Let this page echo elsewhere.")
    ).toBeInTheDocument();
  });

  it("shows empty-state messaging for prep helpers", () => {
    render(
      <PrepPanel
        prepHelpers={null}
        partyConfig={{ size: 4, level: 3, difficulty: "medium" }}
        onPartyConfigChange={() => undefined}
        bestiaryReferences={[]}
        since=""
        onSinceChange={() => undefined}
      />
    );
    expect(screen.getByText("Open a page to generate prep helpers.")).toBeInTheDocument();
  });
});
