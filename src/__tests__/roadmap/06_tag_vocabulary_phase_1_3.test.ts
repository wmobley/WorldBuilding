import { describe, expect, it } from "vitest";
import { parseTagsFromMarkdown } from "../../domain/tags/parseTags";
import { normalizeTags } from "../../domain/tags/normalizeTags";
import { validateTags } from "../../domain/tags/validateTags";
import { buildTagHealthReport } from "../../features/vaultHealth/tagHealthReport";

describe("roadmap/06 tag vocabulary phase 1-3", () => {
  it("parses tags from frontmatter and inline text with normalization", () => {
    const markdown = [
      "---",
      "tags:",
      "  - type:NPC",
      "  - terrain:Greenwood Forest",
      "---",
      "Meet @Status:Alive in #location:Greenwood Village."
    ].join("\n");

    const tags = parseTagsFromMarkdown(markdown).map((tag) => ({
      namespace: tag.namespace,
      value: tag.value
    }));

    expect(tags).toEqual([
      { namespace: "type", value: "npc" },
      { namespace: "terrain", value: "greenwood-forest" },
      { namespace: "status", value: "alive" },
      { namespace: "location", value: "greenwood-village" }
    ]);
  });

  it("normalizes order and deduplicates tags", () => {
    const tags = parseTagsFromMarkdown("Tags @type:NPC and @status:Alive and @type:NPC.");
    const normalized = normalizeTags(tags).map((tag) => `${tag.namespace}:${tag.value}`);
    expect(normalized).toEqual(["status:alive", "type:npc"]);
  });

  it("validates namespaces, values, and patterns", () => {
    const tags = normalizeTags(
      parseTagsFromMarkdown("@type:mountain @unknown:thing @session:2025-1-04")
    );
    const issues = validateTags(tags);
    expect(issues.map((issue) => issue.code)).toEqual([
      "pattern-mismatch",
      "invalid-value",
      "unknown-namespace"
    ]);
  });

  it("builds a tag health report with migrations", () => {
    const docs = [
      {
        id: "doc-1",
        title: "Intro",
        body: "@Type:NPC\n@status:Alive\n@terrain:Forrest"
      }
    ];

    const report = buildTagHealthReport(docs);
    expect(report.totalTags).toBe(3);
    expect(report.namespaces).toEqual({
      status: 1,
      terrain: 1,
      type: 1
    });
    expect(report.migrations.map((m) => m.normalized)).toEqual([
      "@status:alive",
      "@terrain:forrest",
      "@type:npc"
    ]);
  });
});
