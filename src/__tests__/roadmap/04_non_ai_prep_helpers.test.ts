import { describe, expect, it } from "vitest";
import type { Doc, Folder, Tag } from "../../vault/types";
import { buildPrepHelpers } from "../../prep/helpers";

describe("roadmap/04 non-AI prep helpers", () => {
  it("builds deterministic encounter, involvement, and recent-change output", () => {
    const docId = "doc-1";
    const tags: Tag[] = [
      { docId, type: "terrain", value: "forest" },
      { docId, type: "cr", value: "0-1" }
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
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: [],
      docTagsById: {
        [linkedDoc.id]: [{ docId: linkedDoc.id, type: "type", value: "faction" }],
        [backlinkDoc.id]: [{ docId: backlinkDoc.id, type: "type", value: "religion" }]
      },
      locationContextTags: []
    };

    const result = buildPrepHelpers({
      context,
      folders,
      party: { size: 4, level: 3, difficulty: "medium" },
      encounterSeed: "forest-seed"
    });
    expect(result?.suggestEncounter.results.length).toBeGreaterThan(0);
    expect(result?.suggestEncounter.results[0]?.match.terrainTags).toContain("forest");
    expect(result?.suggestEncounter.explain.length).toBeGreaterThan(0);
    expect(result?.suggestEncounter.inputsUsed.tags.creatureTypeTags).toEqual([]);
    expect(result?.suggestEncounter.warnings).toEqual(
      expect.arrayContaining(["Encounter roll fell outside filtered entries; using fallback pick."])
    );
    expect(result?.suggestEncounter.encounterPlan.budget).toBeGreaterThan(0);
    expect(result?.suggestEncounter.encounterPlan.crBuckets).toEqual(["cr:0-1"]);
    expect(result?.suggestEncounter.inputsUsed.table?.id).toBe("forest_encounters_d100");

    expect(result?.whosInvolved.results.map((entry) => entry.title)).toEqual([
      "Iron Concord",
      "Veiled Star"
    ]);
    expect(result?.whosInvolved.inputsUsed.linkedDocIds).toEqual(["doc-2"]);

    const reasons = result?.whatChangedRecently.results.map((entry) => entry.reason) ?? [];
    expect(reasons).toContain("currentDoc");
    expect(reasons).toContain("linked");
    expect(reasons).toContain("backlink");
    expect(result?.whatChangedRecently.inputsUsed.currentDocId).toBe(docId);
    expect(result?.whatChangedRecently.inputsUsed.locationTaggedDocIds).toEqual([]);
  });

  it("rolls encounter suggestions deterministically from tables", () => {
    const docId = "doc-1";
    const tags: Tag[] = [
      { docId, type: "terrain", value: "forest" }
    ];

    const context = {
      currentDoc: {
        id: docId,
        title: "Sapphire Coast",
        tags,
        excerpt: "A haunted coast.",
        folderId: "places",
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

    const result = buildPrepHelpers({
      context,
      folders: [],
      party: { size: 4, level: 3, difficulty: "medium" },
      encounterSeed: "forest-seed"
    });
    const second = buildPrepHelpers({
      context,
      folders: [],
      party: { size: 4, level: 3, difficulty: "medium" },
      encounterSeed: "forest-seed"
    });
    expect(result?.suggestEncounter.encounterPlan.rolls).toEqual(
      second?.suggestEncounter.encounterPlan.rolls
    );
    expect(result?.suggestEncounter.results.map((entry) => entry.text)).toEqual(
      second?.suggestEncounter.results.map((entry) => entry.text)
    );
    expect(result?.suggestEncounter.results[0]?.match.terrainTags).toEqual(["forest"]);
    expect(result?.suggestEncounter.warnings).toEqual(
      expect.arrayContaining(["Some encounters require homebrew mapping."])
    );
  });

  it("builds involvement list from linked and backlink docs with stable ordering", () => {
    const docId = "doc-1";
    const currentDoc: Doc = {
      id: docId,
      title: "Harbor",
      body: "A place.",
      folderId: "places",
      updatedAt: 100,
      campaignId: "camp-1",
      shared: false
    };

    const linkedDocs: Doc[] = [
      {
        id: "doc-2",
        title: "Arcane Circle",
        body: "Faction",
        folderId: "factions",
        updatedAt: 200,
        campaignId: "camp-1",
        shared: false
      },
      {
        id: "doc-3",
        title: "Hidden Tide",
        body: "Figure",
        folderId: "people",
        updatedAt: 210,
        campaignId: "camp-1",
        shared: false
      }
    ];

    const backlinks: Doc[] = [
      {
        id: "doc-4",
        title: "Sun Choir",
        body: "Religion",
        folderId: "religions",
        updatedAt: 190,
        campaignId: "camp-1",
        shared: false
      }
    ];

    const folders: Folder[] = [
      { id: "factions", name: "Factions", parentFolderId: null, campaignId: "camp-1", shared: false },
      { id: "religions", name: "Religions", parentFolderId: null, campaignId: "camp-1", shared: false },
      { id: "people", name: "People", parentFolderId: null, campaignId: "camp-1", shared: false },
      { id: "places", name: "Places", parentFolderId: null, campaignId: "camp-1", shared: false }
    ];

    const context = {
      currentDoc: {
        id: currentDoc.id,
        title: currentDoc.title,
        tags: [],
        excerpt: "A place.",
        folderId: currentDoc.folderId,
        campaignId: currentDoc.campaignId
      },
      linkedDocs,
      backlinks,
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [currentDoc, ...linkedDocs, ...backlinks],
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: [],
      docTagsById: {
        "doc-2": [{ docId: "doc-2", type: "type", value: "faction" }],
        "doc-3": [{ docId: "doc-3", type: "type", value: "npc" }],
        "doc-4": [{ docId: "doc-4", type: "type", value: "religion" }]
      },
      locationContextTags: []
    };

    const result = buildPrepHelpers({
      context,
      folders,
      party: { size: 4, level: 3, difficulty: "medium" }
    });
    expect(result?.whosInvolved.results.map((entry) => entry.title)).toEqual([
      "Arcane Circle",
      "Hidden Tide",
      "Sun Choir"
    ]);
    expect(result?.whosInvolved.results[0]?.sources).toEqual(["linked"]);
    expect(result?.whosInvolved.results[1]?.sources).toEqual(["linked"]);
    expect(result?.whosInvolved.inputsUsed.includedTypes).toEqual([
      "NPC",
      "Faction",
      "Organization",
      "Monster",
      "Figure",
      "Religion"
    ]);
  });

  it("labels recent changes with deterministic reasons and ordering", () => {
    const docId = "doc-1";
    const currentDoc: Doc = {
      id: docId,
      title: "Harbor",
      body: "A place.",
      folderId: "places",
      updatedAt: 500,
      campaignId: "camp-1",
      shared: false
    };

    const linkedDoc: Doc = {
      id: "doc-2",
      title: "Arcane Circle",
      body: "Faction",
      folderId: "factions",
      updatedAt: 480,
      campaignId: "camp-1",
      shared: false
    };

    const backlinkDoc: Doc = {
      id: "doc-3",
      title: "Sun Choir",
      body: "Religion",
      folderId: "religions",
      updatedAt: 470,
      campaignId: "camp-1",
      shared: false
    };

    const otherDoc: Doc = {
      id: "doc-4",
      title: "Ledger",
      body: "Notes",
      folderId: "places",
      updatedAt: 460,
      campaignId: "camp-1",
      shared: false
    };

    const context = {
      currentDoc: {
        id: currentDoc.id,
        title: currentDoc.title,
        tags: [],
        excerpt: "A place.",
        folderId: currentDoc.folderId,
        campaignId: currentDoc.campaignId
      },
      linkedDocs: [linkedDoc],
      backlinks: [backlinkDoc],
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [currentDoc, linkedDoc, backlinkDoc, otherDoc],
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: [],
      docTagsById: {},
      locationContextTags: []
    };

    const result = buildPrepHelpers({
      context,
      folders: [],
      party: { size: 4, level: 3, difficulty: "medium" }
    });
    expect(result?.whatChangedRecently.results.map((entry) => entry.reason)).toEqual([
      "currentDoc",
      "linked",
      "backlink",
      "recentCampaignUpdate"
    ]);
    expect(result?.whatChangedRecently.results[0]?.title).toBe("Harbor");
    expect(result?.whatChangedRecently.warnings).toEqual([]);
    expect(result?.whatChangedRecently.results[0]?.change).toBe("A place.");
  });

  it("includes location-tagged actors when current context is a location", () => {
    const docId = "doc-1";
    const currentDoc: Doc = {
      id: docId,
      title: "Greenwood Village",
      body: "A village.",
      folderId: "places",
      updatedAt: 500,
      campaignId: "camp-1",
      shared: false
    };

    const locationTagged: Doc[] = [
      {
        id: "doc-2",
        title: "Mayor Roland",
        body: "NPC",
        folderId: "people",
        updatedAt: 480,
        campaignId: "camp-1",
        shared: false
      }
    ];

    const context = {
      currentDoc: {
        id: currentDoc.id,
        title: currentDoc.title,
        tags: [{ docId, type: "type", value: "location" }],
        excerpt: "A village.",
        folderId: currentDoc.folderId,
        campaignId: currentDoc.campaignId
      },
      linkedDocs: [],
      backlinks: [],
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [currentDoc, ...locationTagged],
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: locationTagged,
      docTagsById: {
        "doc-2": [
          { docId: "doc-2", type: "type", value: "npc" },
          { docId: "doc-2", type: "location", value: "greenwood-village" }
        ]
      },
      locationContextTags: ["greenwood-village"]
    };

    const result = buildPrepHelpers({
      context,
      folders: [],
      party: { size: 4, level: 3, difficulty: "medium" }
    });
    expect(result?.whosInvolved.results.map((entry) => entry.title)).toEqual([
      "Mayor Roland"
    ]);
    expect(result?.whosInvolved.results[0]?.sources).toEqual(["locationTag"]);
    expect(result?.whosInvolved.inputsUsed.locationTags).toEqual(["greenwood-village"]);
  });

  it("filters recent changes by since date and uses change_summary frontmatter", () => {
    const docId = "doc-1";
    const currentDoc: Doc = {
      id: docId,
      title: "Greenwood Village",
      body: "---\nchange_summary: \"Village hall rebuilt\"\n---\nDetails.",
      folderId: "places",
      updatedAt: new Date("2025-12-20T00:00:00Z").getTime(),
      campaignId: "camp-1",
      shared: false
    };

    const olderDoc: Doc = {
      id: "doc-2",
      title: "Mayor Roland",
      body: "Notes.",
      folderId: "people",
      updatedAt: new Date("2025-11-20T00:00:00Z").getTime(),
      campaignId: "camp-1",
      shared: false
    };

    const context = {
      currentDoc: {
        id: currentDoc.id,
        title: currentDoc.title,
        tags: [{ docId, type: "type", value: "location" }],
        excerpt: "A village.",
        folderId: currentDoc.folderId,
        campaignId: currentDoc.campaignId
      },
      linkedDocs: [],
      backlinks: [],
      relatedDocsByTag: [],
      recentlyUpdatedDocs: [currentDoc, olderDoc],
      folderContext: { folder: null, siblings: [] },
      locationTaggedDocs: [],
      docTagsById: {},
      locationContextTags: []
    };

    const result = buildPrepHelpers({
      context,
      folders: [],
      party: { size: 4, level: 3, difficulty: "medium" },
      since: "2025-12-01T00:00:00Z"
    });

    expect(result?.whatChangedRecently.results.map((entry) => entry.title)).toEqual([
      "Greenwood Village"
    ]);
    expect(result?.whatChangedRecently.results[0]?.change).toBe("Village hall rebuilt");
    expect(result?.whatChangedRecently.inputsUsed.since).toBe("2025-12-01T00:00:00.000Z");
  });
});
