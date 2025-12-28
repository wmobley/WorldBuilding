import type { ParsedTag } from "./parseTags";

export type NormalizedTag = ParsedTag;

export function normalizeTags(tags: ParsedTag[]): NormalizedTag[] {
  const unique = new Map<string, ParsedTag>();

  for (const tag of tags) {
    const key = `${tag.namespace}:${tag.value}`;
    if (!unique.has(key)) unique.set(key, tag);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const namespaceCompare = a.namespace.localeCompare(b.namespace);
    if (namespaceCompare !== 0) return namespaceCompare;
    return a.value.localeCompare(b.value);
  });
}
