import type { TagValidationIssue } from "./types";
import type { NormalizedTag } from "./normalizeTags";
import { tagVocabulary } from "./vocabulary";

export type TagValidationOptions = {
  strictNamespaces?: boolean;
  customValues?: Record<string, string[]>;
};

const vocabularyByNamespace = new Map(
  tagVocabulary.map((spec) => [spec.namespace, spec])
);

function formatTag(tag: NormalizedTag): string {
  if (tag.raw) return tag.raw;
  return `@${tag.namespace}:${tag.value}`;
}

function getCustomValues(namespace: string, customValues?: Record<string, string[]>): Set<string> {
  return new Set(customValues?.[namespace] ?? []);
}

export function validateTags(
  tags: NormalizedTag[],
  options: TagValidationOptions = {}
): TagValidationIssue[] {
  const issues: TagValidationIssue[] = [];
  const { strictNamespaces = false, customValues } = options;

  for (const tag of tags) {
    const spec = vocabularyByNamespace.get(tag.namespace);
    const tagLabel = formatTag(tag);

    if (!spec) {
      issues.push({
        severity: strictNamespaces ? "error" : "warn",
        code: "unknown-namespace",
        message: `Unknown namespace "${tag.namespace}".`,
        tag: tagLabel
      });
      continue;
    }

    if (spec.pattern) {
      const pattern = new RegExp(spec.pattern);
      if (!pattern.test(tag.value)) {
        issues.push({
          severity: "error",
          code: "pattern-mismatch",
          message: `Value "${tag.value}" does not match ${spec.pattern}.`,
          tag: tagLabel
        });
      }
    }

    if (spec.kind === "closed") {
      const allowed = new Set(spec.values ?? []);
      if (!allowed.has(tag.value)) {
        issues.push({
          severity: "error",
          code: "invalid-value",
          message: `Value "${tag.value}" is not allowed for "${spec.namespace}".`,
          tag: tagLabel
        });
      }
      continue;
    }

    if (spec.kind === "semi") {
      const allowed = new Set([...(spec.values ?? []), ...getCustomValues(spec.namespace, customValues)]);
      if (!allowed.has(tag.value)) {
        issues.push({
          severity: "warn",
          code: "unregistered-value",
          message: `Value "${tag.value}" is not registered for "${spec.namespace}".`,
          tag: tagLabel
        });
      }
    }
  }

  return issues;
}
