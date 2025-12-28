import type { Tag } from "./types";

export type ParsedTag = Tag & {
  raw: string;
  source: "inline" | "frontmatter";
  prefix?: "@" | "#";
};

const inlineTagRegex = /([@#])([a-zA-Z][\w-]*):/g;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNamespace(namespace: string): string {
  return namespace
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeValue(value: string): string {
  return slugify(value);
}

function parseFrontmatterTags(markdown: string): string[] {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return [];
  const frontmatter = match[1];
  const lines = frontmatter.split("\n");
  const tags: string[] = [];
  let inTags = false;

  for (const line of lines) {
    if (!inTags) {
      const tagLine = line.match(/^\s*tags\s*:\s*(.*)$/);
      if (!tagLine) continue;
      const inline = tagLine[1].trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        inner
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => tags.push(item));
        break;
      }
      inTags = true;
      continue;
    }

    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem) {
      tags.push(listItem[1].trim());
      continue;
    }

    if (/^\s*\w/.test(line)) break;
  }

  return tags;
}

function parseTagString(raw: string, source: "frontmatter"): ParsedTag | null {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return null;
  const match = trimmed.match(/^([@#])?([a-zA-Z][\w-]*):(.+)$/);
  if (!match) return null;
  const prefix = match[1] as "@" | "#" | undefined;
  const namespace = normalizeNamespace(match[2]);
  const value = normalizeValue(match[3]);
  if (!namespace || !value) return null;
  return { namespace, value, raw: trimmed, source, prefix };
}

export function parseTagsFromMarkdown(markdown: string): ParsedTag[] {
  const tags: ParsedTag[] = [];

  for (const raw of parseFrontmatterTags(markdown)) {
    const parsed = parseTagString(raw, "frontmatter");
    if (parsed) tags.push(parsed);
  }

  const matches = Array.from(markdown.matchAll(inlineTagRegex));
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const prefix = match[1] as "@" | "#";
    const namespace = normalizeNamespace(match[2]);
    const valueStart = (match.index ?? 0) + match[0].length;
    const nextMatch = matches[index + 1];
    const valueEnd = nextMatch?.index ?? markdown.length;
    let rawValue = markdown.slice(valueStart, valueEnd).trim();
    if (nextMatch && /\s/.test(rawValue)) {
      rawValue = rawValue.split(/\s+/)[0];
    }
    rawValue = rawValue.replace(/[.,;:!?]+$/g, "");
    const value = normalizeValue(rawValue);
    if (!namespace || !value) continue;
    const raw = `${prefix}${match[2]}:${rawValue}`;
    tags.push({ namespace, value, raw, source: "inline", prefix });
  }

  return tags;
}
