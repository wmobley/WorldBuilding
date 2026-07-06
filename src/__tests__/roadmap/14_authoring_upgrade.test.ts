import { describe, expect, it } from "vitest";
import {
  extractHeadings,
  parseMarkdownPage,
  replaceWikiLinkTarget
} from "../../domain/markdown/pageModel";
import { buildVaultDiagnostics } from "../../features/vaultDiagnostics/buildVaultDiagnostics";
import { parseLinks } from "../../vault/parser";
import type { Doc } from "../../vault/types";

function doc(id: string, title: string, body: string): Doc {
  return {
    id,
    title,
    body,
    folderId: null,
    updatedAt: 1,
    campaignId: "campaign-1",
    shared: false,
    deletedAt: null
  };
}

describe("roadmap/14 authoring upgrade", () => {
  it("parses frontmatter and extracts stable heading ids", () => {
    const markdown = [
      "---",
      "type: deity",
      "domain:",
      "  - trials",
      "  - heroism",
      "---",
      "# Saint Applause",
      "## Trials",
      "## Trials"
    ].join("\n");

    const page = parseMarkdownPage(markdown);
    expect(page.frontmatter?.fields.type).toBe("deity");
    expect(page.frontmatter?.fields.domain).toEqual(["trials", "heroism"]);
    expect(extractHeadings(markdown).map((heading) => heading.id)).toEqual([
      "saint-applause",
      "trials",
      "trials-2"
    ]);
  });

  it("updates exact wikilink targets while preserving aliases and section links", () => {
    const next = replaceWikiLinkTarget(
      "[[Old Page]] [[Old Page#Secrets]] [[Old Page|alias]] [[Other Page]]",
      "Old Page",
      "New Page"
    );
    expect(next).toBe(
      "[[New Page]] [[New Page#Secrets]] [[New Page|alias]] [[Other Page]]"
    );
  });

  it("does not treat wiki media embeds as document links", () => {
    const links = parseLinks("[[Lore Page]]\n![[portrait.png|Portrait]]");
    expect(links.map((link) => link.targetTitle)).toEqual(["Lore Page"]);
  });

  it("reports broken links, duplicate titles, malformed frontmatter, and inserts", () => {
    const docs = [
      doc("doc-1", "Welcome", "[[Missing Page]]\n{{insert: Missing Insert}}"),
      doc("doc-2", "Duplicate", "---\ntype deity\n---\nBody"),
      doc("doc-3", "Duplicate", "@unknown:value")
    ];

    const report = buildVaultDiagnostics({
      docs,
      references: [],
      mapLocations: []
    });

    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "broken-wikilink",
        "broken-insert",
        "duplicate-title",
        "malformed-frontmatter",
        "invalid-tag"
      ])
    );
  });
});
