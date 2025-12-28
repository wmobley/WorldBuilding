import type { ReactNode } from "react";
import type { Doc, Folder } from "../../vault/types";
import type { WorldbuildAnchorType } from "../../ai/worldbuild";
import { INDEX_END, INDEX_START } from "../../vault/indexing";

const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function collectFolderPath(folderId: string | null, folderMap: Map<string, Folder>) {
  const names: string[] = [];
  let current = folderId ? folderMap.get(folderId) ?? null : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) ?? null : null;
  }
  return names.map((name) => name.toLowerCase());
}

export function classifyAnchorType(
  doc: Doc,
  folderMap: Map<string, Folder>
): WorldbuildAnchorType {
  const path = collectFolderPath(doc.folderId ?? null, folderMap);
  if (path.includes("factions")) return "Faction";
  if (path.includes("religions")) return "Religion";
  if (path.includes("notable figures") || path.includes("people")) return "Figure";
  if (path.includes("regions") || path.includes("places") || path.includes("locations")) {
    return "Region";
  }
  return "Other";
}

export function applyTemplateTitle(template: string, title: string) {
  const lines = template.split("\n");
  if (lines[0]?.startsWith("# ")) {
    lines[0] = `# ${title}`;
    return lines.join("\n");
  }
  return template;
}

export function suggestTitleFromText(text: string) {
  const trimmed = text.trim();
  const markdownLink = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (markdownLink?.[1]) return markdownLink[1].trim().replace(/[:\s]+$/, "");
  const wikiMatch = trimmed.match(/\[\[([^\]]+)\]\]/);
  if (wikiMatch?.[1]) {
    const inner = wikiMatch[1];
    const [, alias] = inner.split("|");
    const label = alias ?? inner.replace(/^doc:/, "");
    return label.trim().replace(/[:\s]+$/, "");
  }
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch?.[1]) return headingMatch[1].trim().replace(/[:\s]+$/, "");
  const boldMatch = trimmed.match(/\*\*([^*]+)\*\*/);
  if (boldMatch?.[1]) return boldMatch[1].trim().replace(/[:\s]+$/, "");
  const italicMatch = trimmed.match(/\*([^*]+)\*/);
  if (italicMatch?.[1]) return italicMatch[1].trim().replace(/[:\s]+$/, "");
  const clean = trimmed
    .replace(/[`*_#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:\s]+$/, "");
  return clean || "New Page";
}

export function parseLinkedDocId(text: string) {
  const trimmed = text.trim();
  const wikiMatch = trimmed.match(/\[\[([^\]]+)\]\]/);
  if (wikiMatch?.[1]) {
    const inner = wikiMatch[1];
    if (inner.startsWith("doc:")) {
      const payload = inner.slice(4);
      const [id] = payload.split("|");
      return id ?? null;
    }
  }
  const markdownMatch = trimmed.match(/\((doc:[^)]+)\)/);
  if (markdownMatch?.[1]) {
    const payload = markdownMatch[1].slice(4);
    const [id] = payload.split("|");
    return id ?? null;
  }
  return null;
}

export function transformWikilinks(markdown: string) {
  return markdown.replace(wikilinkRegex, (_, target: string, alias?: string) => {
    const label = (alias || target).trim();
    const trimmed = target.trim();
    if (trimmed.toLowerCase().startsWith("folder:")) {
      const folderName = trimmed.slice("folder:".length).trim();
      const display = alias ? alias.trim() : folderName;
      return `[${display}](/folder/${encodeURIComponent(folderName)})`;
    }
    if (trimmed.startsWith("doc:")) {
      const docId = trimmed.slice(4);
      return `[${label}](/doc/${docId})`;
    }
    if (trimmed.startsWith("ref:")) {
      const payload = trimmed.slice(4);
      const [slug, entryId] = payload.split(":");
      if (slug && entryId) {
        return `[${label}](/reference/${slug}?entry=${entryId})`;
      }
      return `[${label}](ref:${payload})`;
    }
    const href = `wiki:${encodeURIComponent(trimmed)}`;
    return `[${label}](${href})`;
  });
}

export function stripIndexMarkers(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== INDEX_START && trimmed !== INDEX_END;
    })
    .join("\n");
}

export function extractText(nodes: ReactNode): string {
  if (typeof nodes === "string") return nodes;
  if (Array.isArray(nodes)) return nodes.map(extractText).join("");
  if (nodes && typeof nodes === "object" && "props" in nodes) {
    return extractText((nodes as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return "";
}
