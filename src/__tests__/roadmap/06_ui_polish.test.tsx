import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TagsPanel from "../../ui/marginalia/TagsPanel";
import BacklinksPanel from "../../ui/marginalia/BacklinksPanel";
import PrepPanel from "../../ui/marginalia/PrepPanel";

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
    render(<PrepPanel prepHelpers={null} />);
    expect(screen.getByText("Open a page to generate prep helpers.")).toBeInTheDocument();
  });
});
