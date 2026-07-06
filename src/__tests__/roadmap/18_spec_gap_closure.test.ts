import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  countWikiLinkTargetReplacements,
  extractHeadings
} from "../../domain/markdown/pageModel";
import { buildVaultDiagnostics } from "../../features/vaultDiagnostics/buildVaultDiagnostics";
import { searchVaultDocs } from "../../features/vaultSearch/searchVault";
import {
  assetGalleryMarkdown,
  buildMapStoragePath
} from "../../vault/assets";
import type { Asset, Doc } from "../../vault/types";
import { buildDocumentTitle, buildMetaDescription } from "../../lib/useDocumentMeta";

function doc(id: string, title: string, body: string, shared = false): Doc {
  return {
    id,
    title,
    body,
    folderId: null,
    updatedAt: 1,
    campaignId: "campaign-1",
    shared
  };
}

const asset: Asset = {
  id: "asset-1",
  campaignId: "campaign-1",
  docId: "doc-1",
  storagePath: "campaign-1/asset-1-halo.png",
  filename: "halo.png",
  contentType: "image/png",
  sizeBytes: 10,
  altText: "Halo",
  createdAt: 1,
  updatedAt: 1
};

describe("roadmap/18 spec gap closure", () => {
  it("searches vault body text with snippets", () => {
    const results = searchVaultDocs(
      [
        doc("doc-1", "Saint Applause", "Trials produce heroes."),
        doc("doc-2", "Neutral Title", "The tri-blood war begins below.")
      ],
      "tri-blood"
    );

    expect(results).toHaveLength(1);
    expect(results[0].doc.id).toBe("doc-2");
    expect(results[0].matchType).toBe("body");
    expect(results[0].snippet).toContain("tri-blood war");
  });

  it("counts rename link updates before mutation", () => {
    expect(
      countWikiLinkTargetReplacements(
        "[[Old Page]] [[Old Page#Secrets]] [[Old Page|Alias]] ![[asset:Old Page]]",
        "Old Page"
      )
    ).toBe(3);
  });

  it("keeps duplicate heading ids consistent for table-of-contents links", () => {
    expect(extractHeadings("# One\n## Repeat\n## Repeat").map((heading) => heading.id)).toEqual([
      "one",
      "repeat",
      "repeat-2"
    ]);
  });

  it("reports broken section links, gallery assets, and import parse errors", () => {
    const report = buildVaultDiagnostics({
      docs: [
        doc(
          "doc-1",
          "Lore Page",
          "[[Target Page#Missing]]\n{{gallery: asset:asset-1, asset:missing}}"
        ),
        doc("doc-2", "Target Page", "# Existing")
      ],
      references: [],
      mapLocations: [],
      assetPaths: [`asset:${asset.id}`, asset.storagePath],
      importErrors: [{ title: "Import failed", detail: "Unexpected token" }]
    });

    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["broken-section-link", "broken-embed", "import-parse-error"])
    );
  });

  it("builds map storage paths, gallery embeds, and document metadata", () => {
    expect(buildMapStoragePath("campaign-1", "map-1", "Upper Level.PNG")).toBe(
      "campaign-1/maps/map-1-upper-level.png"
    );
    expect(assetGalleryMarkdown([asset])).toBe("{{gallery: asset:asset-1}}");
    expect(buildDocumentTitle("Lore Page", "World One")).toBe(
      "Lore Page / World One / Worldbuilder"
    );
    expect(buildMetaDescription("# Heading\n\nA long passage about a faction.")).toContain(
      "Heading A long passage"
    );
  });

  it("documents shared asset RLS and Storage policies in SQL", () => {
    const sharingSql = readFileSync(
      `${process.cwd()}/supabase/campaign-sharing.sql`,
      "utf8"
    );
    const storageSql = readFileSync(
      `${process.cwd()}/supabase/assets-storage.sql`,
      "utf8"
    );

    expect(sharingSql).toContain("assets_select_shared");
    expect(storageSql).toContain("public.is_campaign_member");
    expect(storageSql).toContain("a.storage_path = storage.objects.name");
  });
});
