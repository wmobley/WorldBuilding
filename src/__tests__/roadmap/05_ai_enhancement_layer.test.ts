import { describe, expect, it } from "vitest";
import {
  buildWorldbuildInputs,
  buildWorldbuildPrompt,
  parseWorldbuildDrafts
} from "../../ai/worldbuild";
import type { WorldContext } from "../../prep/context";
import type { WorldbuildAnchor } from "../../ai/worldbuild";

describe("roadmap/05 ai enhancement layer - prompt safety and parsing", () => {
  it("builds prompt inputs without auto-writing content", () => {
    const context: WorldContext = {
      currentDoc: {
        id: "doc-1",
        title: "Aurelian",
        tags: [{ docId: "doc-1", type: "ecosystem", value: "coastal" }],
        excerpt: "A seaside city.",
        folderId: null,
        campaignId: "camp-1"
      },
      linkedDocs: [],
      backlinks: [],
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [],
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: [],
      docTagsById: {},
      locationContextTags: []
    };
    const anchors: WorldbuildAnchor[] = [
      { id: "doc-2", title: "Iron Concord", type: "Faction" }
    ];
    const inputs = buildWorldbuildInputs(context, anchors, "  ");
    expect(inputs.tone).toBe("neutral");
    expect(inputs.worldContext.currentDoc.tags).toEqual(["@ecosystem:coastal"]);

    const prompt = buildWorldbuildPrompt("Template", inputs);
    expect(prompt).toContain("## Inputs");
    expect(prompt).toContain("\"tone\": \"neutral\"");
  });

  it("parses structured draft payloads and rejects malformed content", () => {
    const valid = JSON.stringify({
      drafts: [
        {
          title: "New Place",
          folderHint: "Places",
          bodyMarkdown: "Details",
          linksTo: ["Aurelian"],
          tags: ["@ecosystem:coastal"]
        }
      ]
    });
    expect(parseWorldbuildDrafts(valid)?.length).toBe(1);
    expect(parseWorldbuildDrafts("Not JSON")).toBeNull();
  });
});
