import { describe, expect, it } from "vitest";
import type { Doc, Folder, ReferenceEntry, Tag } from "../../vault/types";
import { buildPrepHelpers } from "../../prep/helpers";

describe("roadmap/04 non-AI prep helpers", () => {
  it("builds deterministic encounter, involvement, and recent-change output", () => {
    const docId = "doc-1";
    const tags: Tag[] = [
      { docId, type: "creature", value: "undead" },
      { docId, type: "ecosystem", value: "forest" }
    ];

    const linkedDoc: Doc = {
      id: "doc-2",
      title: "Iron Concord",
      body: "Faction details",
      folderId: "factions",
      updatedAt: 200,
      campaignId: "camp-1",
      shared: false
    };

    const backlinkDoc: Doc = {
      id: "doc-3",
      title: "Veiled Star",
      body: "Religion details",
      folderId: "religions",
      updatedAt: 150,
      campaignId: "camp-1",
      shared: false
    };

    const currentDoc: Doc = {
      id: docId,
      title: "Sapphire Coast",
      body: "A haunted coast.",
      folderId: "places",
      updatedAt: 220,
      campaignId: "camp-1",
      shared: false
    };

    const folders: Folder[] = [
      { id: "factions", name: "Factions", parentFolderId: null, campaignId: "camp-1", shared: false },
      { id: "religions", name: "Religions", parentFolderId: null, campaignId: "camp-1", shared: false },
      { id: "places", name: "Places", parentFolderId: null, campaignId: "camp-1", shared: false }
    ];

    const bestiaryReferences: ReferenceEntry[] = [
      {
        id: "mon-1",
        slug: "bestiary",
        name: "Forest Wight",
        source: "SRD",
        content: "",
        rawJson: JSON.stringify({
          name: "Forest Wight",
          type: "undead",
          cr: "3",
          environment: ["forest"],
          source: "SRD"
        })
      }
    ];

    const context = {
      currentDoc: {
        id: docId,
        title: currentDoc.title,
        tags,
        excerpt: "A haunted coast.",
        folderId: currentDoc.folderId,
        campaignId: currentDoc.campaignId
      },
      linkedDocs: [linkedDoc],
      backlinks: [backlinkDoc],
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [currentDoc, linkedDoc, backlinkDoc],
      folderContext: { folder: null, siblings: [] }
    };

    const result = buildPrepHelpers({ context, folders, bestiaryReferences });
    expect(result?.suggestEncounter.results).toHaveLength(1);
    expect(result?.suggestEncounter.results[0]?.match.creatureTags).toContain("undead");
    expect(result?.suggestEncounter.results[0]?.match.ecosystemTags).toContain("forest");

    expect(result?.whosInvolved.results.map((entry) => entry.title)).toEqual([
      "Iron Concord",
      "Veiled Star"
    ]);

    const reasons = result?.whatChangedRecently.results.map((entry) => entry.reason) ?? [];
    expect(reasons).toContain("currentDoc");
    expect(reasons).toContain("linked");
    expect(reasons).toContain("backlink");
  });
});
