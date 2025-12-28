import { parseTagsFromMarkdown } from "../domain/tags/parseTags";

export type ParsedLink = {
  targetTitle: string;
  linkText: string;
  docId?: string;
};

export type ParsedTag = {
  type: string;
  value: string;
};

const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseLinks(markdown: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = linkRegex.exec(markdown))) {
    const targetTitle = match[1].trim();
    if (!targetTitle) continue;
    const docId = targetTitle.startsWith("doc:") ? targetTitle.slice(4).trim() : undefined;
    links.push({
      targetTitle,
      linkText: (match[2] || targetTitle).trim(),
      docId
    });
  }
  return links;
}

export function parseTags(markdown: string): ParsedTag[] {
  return parseTagsFromMarkdown(markdown).map((tag) => ({
    type: tag.namespace,
    value: tag.value
  }));
}
