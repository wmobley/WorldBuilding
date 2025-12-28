import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { templates } from "../../lib/templates";

const roadmapFiles = [
  "01_legacy_code_cleanup.md",
  "02_supabase_sync.md",
  "03_session_play.md",
  "04_non_ai_prep_helpers.md",
  "05_ai_enhancement_layer.md",
  "06_ui_polish.md",
  "07_architecture_cleanup.md",
  "08_testing_and_docs.md"
];

describe("roadmap/08 testing and docs - core coverage anchors", () => {
  it("keeps roadmap docs readable with goals and success criteria", () => {
    roadmapFiles.forEach((file) => {
      const content = readFileSync(resolve(process.cwd(), "docs/roadmap", file), "utf-8");
      expect(content).toContain("## Goal");
      expect(content).toContain("## Success Criteria");
    });
  });

  it("exposes core templates for contributor onboarding", () => {
    const ids = templates.map((entry) => entry.id);
    expect(ids).toContain("welcome");
    expect(ids).toContain("faction");
    expect(ids).toContain("region");
  });
});
