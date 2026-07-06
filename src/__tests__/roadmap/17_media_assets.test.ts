import { describe, expect, it } from "vitest";
import {
  assetEmbedMarkdown,
  buildAssetStoragePath,
  sanitizeStorageFilename
} from "../../vault/assets";
import type { Asset } from "../../vault/types";
import { transformWikilinks } from "../../pages/vault/utils";
import { buildVaultDiagnostics } from "../../features/vaultDiagnostics/buildVaultDiagnostics";

const asset: Asset = {
  id: "asset-1",
  campaignId: "campaign-1",
  docId: "doc-1",
  storagePath: "campaign-1/asset-1-halo.png",
  filename: "Halo.png",
  contentType: "image/png",
  sizeBytes: 1234,
  altText: "Cracked halo",
  createdAt: 1,
  updatedAt: 1
};

describe("roadmap/17 media assets", () => {
  it("builds campaign-scoped storage paths and asset embeds", () => {
    expect(sanitizeStorageFilename("My Map FINAL.PNG")).toBe("my-map-final.png");
    expect(buildAssetStoragePath("campaign-1", "asset-1", "My Map FINAL.PNG")).toBe(
      "campaign-1/asset-1-my-map-final.png"
    );
    expect(assetEmbedMarkdown(asset)).toBe("![[asset:asset-1|Cracked halo]]");
  });

  it("preserves wiki media embeds while transforming normal wikilinks", () => {
    const markdown = "![[asset:asset-1|Halo]] links to [[Lore Page]].";

    expect(transformWikilinks(markdown)).toBe(
      "![[asset:asset-1|Halo]] links to [Lore Page](wiki:Lore%20Page)."
    );
  });

  it("resolves asset embeds in diagnostics from asset ids and paths", () => {
    const report = buildVaultDiagnostics({
      docs: [
        {
          id: "doc-1",
          campaignId: "campaign-1",
          folderId: null,
          title: "Lore Page",
          body: "![[asset:asset-1|Halo]]\n\n![[missing.png|Missing]]",
          updatedAt: 1,
          shared: false
        }
      ],
      references: [],
      mapLocations: [],
      assetPaths: [`asset:${asset.id}`, asset.storagePath]
    });

    expect(report.issues.map((issue) => issue.code)).toContain("broken-embed");
    expect(report.issues.filter((issue) => issue.code === "broken-embed")).toHaveLength(1);
  });
});
