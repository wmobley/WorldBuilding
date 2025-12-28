import type { TagValidationIssue } from "../../domain/tags/types";
import type { NormalizedTag } from "../../domain/tags/normalizeTags";
import type { TagValidationOptions } from "../../domain/tags/validateTags";
import { parseTagsFromMarkdown } from "../../domain/tags/parseTags";
import { normalizeTags } from "../../domain/tags/normalizeTags";
import { validateTags } from "../../domain/tags/validateTags";

export type TagHealthDocInput = {
  id: string;
  title: string;
  body: string;
};

export type TagHealthIssue = TagValidationIssue & {
  docId: string;
  title: string;
};

export type TagMigrationSuggestion = {
  docId: string;
  title: string;
  raw: string;
  normalized: string;
};

export type TagHealthReport = {
  totalTags: number;
  namespaces: Record<string, number>;
  invalidTags: TagHealthIssue[];
  migrations: TagMigrationSuggestion[];
};

function normalizedLabel(tag: NormalizedTag): string {
  if (tag.source === "frontmatter" && !tag.prefix) {
    return `${tag.namespace}:${tag.value}`;
  }
  const prefix = tag.prefix ?? (tag.raw.startsWith("#") ? "#" : "@");
  return `${prefix}${tag.namespace}:${tag.value}`;
}

export function buildTagHealthReport(
  docs: TagHealthDocInput[],
  options: TagValidationOptions = {}
): TagHealthReport {
  const namespaces: Record<string, number> = {};
  const invalidTags: TagHealthIssue[] = [];
  const migrations: TagMigrationSuggestion[] = [];
  let totalTags = 0;

  for (const doc of docs) {
    const parsed = parseTagsFromMarkdown(doc.body);
    const normalized = normalizeTags(parsed);
    totalTags += normalized.length;

    for (const tag of normalized) {
      namespaces[tag.namespace] = (namespaces[tag.namespace] ?? 0) + 1;
      const normalizedTag = normalizedLabel(tag);
      if (tag.raw && normalizedTag !== tag.raw.trim()) {
        migrations.push({
          docId: doc.id,
          title: doc.title,
          raw: tag.raw,
          normalized: normalizedTag
        });
      }
    }

    const issues = validateTags(normalized, options);
    for (const issue of issues) {
      invalidTags.push({
        ...issue,
        docId: doc.id,
        title: doc.title
      });
    }
  }

  return { totalTags, namespaces, invalidTags, migrations };
}
