import type { Doc } from "../../vault/types";

export type VaultSearchResult = {
  doc: Doc;
  matchType: "title" | "body";
  snippet: string;
};

function normalize(value: string) {
  return value.toLowerCase();
}

function cleanBody(body: string) {
  return body
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2 $1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2 $1")
    .replace(/{{\s*(insert|gallery):\s*([^}]+?)\s*}}/g, "$2")
    .replace(/:::[^\n]+/g, "")
    .replace(/[#>*_`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(text: string, query: string, radius = 48) {
  const cleaned = cleanBody(text);
  if (!cleaned) return "";
  const index = normalize(cleaned).indexOf(normalize(query));
  if (index < 0) return cleaned.slice(0, radius * 2).trim();
  const start = Math.max(0, index - radius);
  const end = Math.min(cleaned.length, index + query.length + radius);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < cleaned.length ? " ..." : "";
  return `${prefix}${cleaned.slice(start, end).trim()}${suffix}`;
}

export function searchVaultDocs(docs: Doc[], query: string, limit = 8): VaultSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = normalize(trimmed);

  return docs
    .filter((doc) => !doc.deletedAt)
    .map((doc): VaultSearchResult | null => {
      const title = normalize(doc.title);
      if (title.includes(lower)) {
        return {
          doc,
          matchType: "title",
          snippet: buildSnippet(doc.body, trimmed)
        };
      }
      if (normalize(cleanBody(doc.body)).includes(lower)) {
        return {
          doc,
          matchType: "body",
          snippet: buildSnippet(doc.body, trimmed)
        };
      }
      return null;
    })
    .filter((result): result is VaultSearchResult => Boolean(result))
    .sort((a, b) => {
      if (a.matchType !== b.matchType) return a.matchType === "title" ? -1 : 1;
      return a.doc.title.localeCompare(b.doc.title);
    })
    .slice(0, limit);
}
