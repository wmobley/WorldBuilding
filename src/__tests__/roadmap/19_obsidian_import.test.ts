import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  normalizeVaultPath,
  parseGithubRepoUrl,
  parseObsidianZip,
  rewriteObsidianImageEmbeds
} from "../../lib/obsidianImport";

async function buildZip(entries: Record<string, string | Uint8Array>) {
  const zip = new JSZip();
  Object.entries(entries).forEach(([path, content]) => {
    zip.file(path, content);
  });
  return zip.generateAsync({ type: "blob" });
}

describe("roadmap/19 obsidian import", () => {
  it("normalizes safe vault paths and rejects unsafe paths", () => {
    expect(normalizeVaultPath("Places/Town.md")).toBe("Places/Town.md");
    expect(normalizeVaultPath("Places\\Town.md")).toBe("Places/Town.md");
    expect(normalizeVaultPath("../Town.md")).toBeNull();
    expect(normalizeVaultPath("/Town.md")).toBeNull();
    expect(normalizeVaultPath("C:/Town.md")).toBeNull();
  });

  it("parses markdown and common images while skipping hidden/system paths", async () => {
    const archive = await buildZip({
      "My Vault/Places/Town.md": "# Town\n\n![[town.png]]",
      "My Vault/Places/town.png": new Uint8Array([1, 2, 3]),
      "My Vault/.obsidian/workspace.json": "{}",
      "My Vault/Notes/ignored.pdf": "pdf",
      "__MACOSX/._Town.md": "metadata",
      "../escape.md": "bad"
    });

    const preview = await parseObsidianZip(archive);

    expect(preview.stats.strippedArchiveRoot).toBe("My Vault");
    expect(preview.docs).toHaveLength(1);
    expect(preview.docs[0]).toMatchObject({
      sourcePath: "Places/Town.md",
      title: "Town",
      folderPath: ["Places"]
    });
    expect(preview.images).toHaveLength(1);
    expect(preview.images[0]).toMatchObject({
      sourcePath: "Places/town.png",
      filename: "town.png",
      contentType: "image/png"
    });
    expect(preview.images[0].file.type).toBe("image/png");
    expect(preview.skipped.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining(["hidden-system-path", "unsupported-file", "unsafe-path"])
    );
  });

  it("supports root-path filtering after stripping a shared archive root", async () => {
    const archive = await buildZip({
      "repo-main/Vault/A.md": "A",
      "repo-main/Vault/Nested/B.md": "B",
      "repo-main/Docs/C.md": "C"
    });

    const preview = await parseObsidianZip(archive, { rootPath: "Vault" });

    expect(preview.docs.map((doc) => doc.sourcePath).sort()).toEqual([
      "A.md",
      "Nested/B.md"
    ]);
    expect(preview.skipped.some((entry) => entry.reason === "outside-root")).toBe(true);
  });

  it("warns for duplicate note titles", async () => {
    const archive = await buildZip({
      "A/Town.md": "One",
      "B/Town.md": "Two"
    });

    const preview = await parseObsidianZip(archive);

    expect(preview.warnings.filter((warning) => warning.code === "duplicate-title")).toHaveLength(2);
  });

  it("normalizes public GitHub repository import metadata", () => {
    const repo = parseGithubRepoUrl(
      "https://github.com/owner/world-vault",
      "main",
      "Campaign Vault"
    );

    expect(repo).toMatchObject({
      owner: "owner",
      repo: "world-vault",
      branch: "main",
      rootPath: "Campaign Vault",
      sourceKey: "github:owner/world-vault:main:Campaign Vault"
    });
    expect(repo.archiveUrl).toContain("https://codeload.github.com/owner/world-vault/zip/");
  });

  it("rewrites imported Obsidian image embeds to stable asset embeds", () => {
    const body = "Map: ![[town.png|Town map]]\nOther: ![[Other.md]]";
    const assets = new Map([
      [
        "Places/town.png",
        {
          id: "asset-1",
          filename: "town.png",
          altText: null
        }
      ]
    ]);

    expect(rewriteObsidianImageEmbeds(body, "Places/Town.md", assets)).toBe(
      "Map: ![[asset:asset-1|Town map]]\nOther: ![[Other.md]]"
    );
  });
});
