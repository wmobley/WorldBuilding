import type { Doc } from "./types";

export const INDEX_START = "<!-- WB:INDEX_START -->";
export const INDEX_END = "<!-- WB:INDEX_END -->";

export function isIndexDoc(doc: Doc) {
  return doc.body.includes(INDEX_START) || doc.title.endsWith(" Index");
}
