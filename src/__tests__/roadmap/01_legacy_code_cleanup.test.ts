import { describe, expect, it } from "vitest";
import { parseLinks, parseTags } from "../../vault/parser";
import {
  stripIndexMarkers,
  transformWikilinks,
  suggestTitleFromText
} from "../../pages/vault/utils";
import { INDEX_END, INDEX_START } from "../../vault/indexing";

describe("roadmap/01 legacy code cleanup - core utilities", () => {
  it("parses wikilinks with aliases and doc ids", () => {
    const markdown = "See [[Alpha]] and [[doc:123|Bravo]] for details.";
    const links = parseLinks(markdown);
    expect(links).toEqual([
      { targetTitle: "Alpha", linkText: "Alpha", docId: undefined },
      { targetTitle: "doc:123", linkText: "Bravo", docId: "123" }
    ]);
  });

  it("parses typed tags and normalizes case", () => {
    const markdown = "Tags: @Creature:Undead and @ecosystem:Forest";
    const tags = parseTags(markdown);
    expect(tags).toEqual([
      { type: "creature", value: "undead" },
      { type: "ecosystem", value: "forest" }
    ]);
  });

  it("transforms wiki links into routes and preserves labels", () => {
    const markdown =
      "Visit [[folder:Factions|Factions]] and [[doc:abc|Doc]]. See [[ref:spells:fireball|Spell]].";
    const result = transformWikilinks(markdown);
    expect(result).toContain("](/folder/Factions)");
    expect(result).toContain("](/doc/abc)");
    expect(result).toContain("](/reference/spells?entry=fireball)");
  });

  it("strips index markers from generated documents", () => {
    const markdown = ["Intro", INDEX_START, "Body", INDEX_END, "Outro"].join("\n");
    expect(stripIndexMarkers(markdown)).toBe(["Intro", "Body", "Outro"].join("\n"));
  });

  it("suggests a title from markdown content", () => {
    expect(suggestTitleFromText("# The Sapphire Coast")).toBe("The Sapphire Coast");
    expect(suggestTitleFromText("[[doc:xyz|Iron Concord]]")).toBe("Iron Concord");
  });
});
