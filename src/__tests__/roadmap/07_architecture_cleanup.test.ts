import { describe, expect, it } from "vitest";
import type { Doc, Folder } from "../../vault/types";
import { collectFolderPath, classifyAnchorType } from "../../pages/vault/utils";

describe("roadmap/07 architecture cleanup - shared utilities", () => {
  it("collects folder paths and classifies anchor types", () => {
    const folders: Folder[] = [
      { id: "world", name: "World", parentFolderId: null, campaignId: "camp", shared: false },
      { id: "factions", name: "Factions", parentFolderId: "world", campaignId: "camp", shared: false },
      { id: "people", name: "People", parentFolderId: "world", campaignId: "camp", shared: false },
      { id: "figures", name: "Notable Figures", parentFolderId: "people", campaignId: "camp", shared: false }
    ];
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    const doc: Doc = {
      id: "doc-1",
      title: "Iron Concord",
      body: "",
      folderId: "factions",
      updatedAt: 0,
      campaignId: "camp",
      shared: false
    };
    const figureDoc: Doc = {
      ...doc,
      id: "doc-2",
      title: "Lady Varis",
      folderId: "figures"
    };

    expect(collectFolderPath(doc.folderId, folderMap)).toEqual(["world", "factions"]);
    expect(classifyAnchorType(doc, folderMap)).toBe("Faction");
    expect(classifyAnchorType(figureDoc, folderMap)).toBe("Figure");
  });
});
