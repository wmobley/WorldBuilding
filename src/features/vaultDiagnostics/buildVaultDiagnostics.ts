import { parseTagsFromMarkdown } from "../../domain/tags/parseTags";
import { normalizeTags } from "../../domain/tags/normalizeTags";
import { validateTags } from "../../domain/tags/validateTags";
import {
  extractEmbeds,
  extractGalleries,
  extractPageInserts,
  isAssetLikeTarget,
  normalizeSectionId,
  parseMarkdownPage
} from "../../domain/markdown/pageModel";
import { extractHeadings, splitLinkSectionTarget } from "../../domain/markdown/pageModel";
import { parseLinks } from "../../vault/parser";
import { isIndexDoc } from "../../vault/indexing";
import type { Doc, MapLocation, ReferenceEntry } from "../../vault/types";

export type VaultDiagnosticSeverity = "error" | "warning" | "info";

export type VaultDiagnostic = {
  id: string;
  code:
    | "broken-wikilink"
    | "broken-doc-link"
    | "broken-reference"
    | "orphan-doc"
    | "duplicate-title"
    | "malformed-frontmatter"
    | "invalid-tag"
    | "missing-map-pin"
    | "broken-embed"
    | "broken-insert"
    | "broken-section-link"
    | "import-parse-error";
  severity: VaultDiagnosticSeverity;
  title: string;
  detail: string;
  docId?: string;
};

export type VaultDiagnosticsInput = {
  docs: Doc[];
  references: ReferenceEntry[];
  mapLocations: MapLocation[];
  assetPaths?: string[];
  importErrors?: Array<{ docId?: string; title: string; detail: string }>;
};

export type VaultDiagnosticsReport = {
  issues: VaultDiagnostic[];
  counts: Record<VaultDiagnosticSeverity, number>;
};

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function isLocationLike(doc: Doc) {
  const page = parseMarkdownPage(doc.body);
  const type = page.frontmatter?.fields.type;
  if (typeof type === "string" && ["location", "place", "region"].includes(type.toLowerCase())) {
    return true;
  }
  const tags = normalizeTags(parseTagsFromMarkdown(doc.body));
  return tags.some(
    (tag) =>
      (tag.namespace === "type" && ["location", "place", "region"].includes(tag.value)) ||
      tag.namespace === "location"
  );
}

function isExternalAsset(target: string) {
  return /^(https?:|data:|\/)/.test(target.trim());
}

function addIssue(issues: VaultDiagnostic[], issue: Omit<VaultDiagnostic, "id">) {
  issues.push({
    ...issue,
    id: `${issue.code}:${issue.docId ?? "vault"}:${issues.length}`
  });
}

export function buildVaultDiagnostics({
  docs,
  references,
  mapLocations,
  assetPaths = [],
  importErrors = []
}: VaultDiagnosticsInput): VaultDiagnosticsReport {
  const activeDocs = docs.filter((doc) => !doc.deletedAt);
  const issues: VaultDiagnostic[] = [];
  const titleGroups = new Map<string, Doc[]>();
  const docByTitle = new Map<string, Doc>();
  const docIds = new Set(activeDocs.map((doc) => doc.id));
  const referenceKeys = new Set(references.map((entry) => `${entry.slug}:${entry.id}`));
  const mapPinDocIds = new Set(mapLocations.map((location) => location.docId));
  const assetSet = new Set(assetPaths);
  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();
  const headingIdsByDocId = new Map(
    activeDocs.map((doc) => [doc.id, new Set(extractHeadings(doc.body).map((heading) => heading.id))])
  );

  for (const doc of activeDocs) {
    const key = normalizeTitle(doc.title);
    const group = titleGroups.get(key) ?? [];
    group.push(doc);
    titleGroups.set(key, group);
    if (!docByTitle.has(key)) {
      docByTitle.set(key, doc);
    }
  }

  for (const group of titleGroups.values()) {
    if (group.length <= 1) continue;
    for (const doc of group) {
      addIssue(issues, {
        code: "duplicate-title",
        severity: "error",
        docId: doc.id,
        title: `Duplicate title: ${doc.title}`,
        detail: `${group.length} active pages share this title. Wikilinks may open the wrong page.`
      });
    }
  }

  for (const doc of activeDocs) {
    const page = parseMarkdownPage(doc.body);
    if (page.frontmatter?.error) {
      addIssue(issues, {
        code: "malformed-frontmatter",
        severity: "error",
        docId: doc.id,
        title: `Malformed frontmatter in ${doc.title}`,
        detail: page.frontmatter.error
      });
    }

    for (const issue of validateTags(normalizeTags(parseTagsFromMarkdown(doc.body)))) {
      addIssue(issues, {
        code: "invalid-tag",
        severity: "warning",
        docId: doc.id,
        title: `Invalid tag in ${doc.title}`,
        detail: `${issue.code}: ${issue.message}`
      });
    }

    for (const link of parseLinks(doc.body)) {
      const target = link.targetTitle.trim();
      if (!target || target.toLowerCase().startsWith("folder:")) continue;
      if (isAssetLikeTarget(target)) continue;
      outgoingCounts.set(doc.id, (outgoingCounts.get(doc.id) ?? 0) + 1);

      if (target.startsWith("doc:")) {
        const { base: linkedDocId, section } = splitLinkSectionTarget(target.slice(4));
        if (!docIds.has(linkedDocId)) {
          addIssue(issues, {
            code: "broken-doc-link",
            severity: "error",
            docId: doc.id,
            title: `Broken doc link in ${doc.title}`,
            detail: `The link target "${target}" does not match an active page id.`
          });
        } else {
          incomingCounts.set(linkedDocId, (incomingCounts.get(linkedDocId) ?? 0) + 1);
          if (section && !headingIdsByDocId.get(linkedDocId)?.has(normalizeSectionId(section))) {
            addIssue(issues, {
              code: "broken-section-link",
              severity: "warning",
              docId: doc.id,
              title: `Broken section link in ${doc.title}`,
              detail: `The section "#${section}" does not exist on the linked page.`
            });
          }
        }
        continue;
      }

      if (target.startsWith("ref:")) {
        const payload = target.slice(4);
        const [slug, ...idParts] = payload.split(":");
        const id = idParts.join(":");
        if (!slug || !id || !referenceKeys.has(`${slug}:${id}`)) {
          addIssue(issues, {
            code: "broken-reference",
            severity: "error",
            docId: doc.id,
            title: `Broken reference link in ${doc.title}`,
            detail: `The reference target "${target}" could not be resolved.`
          });
        }
        continue;
      }

      const { base: targetTitle, section } = splitLinkSectionTarget(target);
      const targetDoc = docByTitle.get(normalizeTitle(targetTitle));
      if (!targetDoc) {
        addIssue(issues, {
          code: "broken-wikilink",
          severity: "error",
          docId: doc.id,
          title: `Broken wikilink in ${doc.title}`,
          detail: `No active page is titled "${targetTitle}".`
        });
      } else {
        incomingCounts.set(targetDoc.id, (incomingCounts.get(targetDoc.id) ?? 0) + 1);
        if (section && !headingIdsByDocId.get(targetDoc.id)?.has(normalizeSectionId(section))) {
          addIssue(issues, {
            code: "broken-section-link",
            severity: "warning",
            docId: doc.id,
            title: `Broken section link in ${doc.title}`,
            detail: `The section "#${section}" does not exist on "${targetDoc.title}".`
          });
        }
      }
    }

    for (const insert of extractPageInserts(doc.body)) {
      if (!docByTitle.has(normalizeTitle(insert.target))) {
        addIssue(issues, {
          code: "broken-insert",
          severity: "error",
          docId: doc.id,
          title: `Broken page insert in ${doc.title}`,
          detail: `No active page is titled "${insert.target}".`
        });
      }
    }

    for (const embed of extractEmbeds(doc.body)) {
      if (isExternalAsset(embed.target)) continue;
      if (assetSet.size > 0 && assetSet.has(embed.target)) continue;
      addIssue(issues, {
        code: "broken-embed",
        severity: "warning",
        docId: doc.id,
        title: `Unresolved media embed in ${doc.title}`,
        detail: `The asset "${embed.target}" is not available in the current asset index.`
      });
    }

    for (const gallery of extractGalleries(doc.body)) {
      for (const target of gallery.targets) {
        if (isExternalAsset(target)) continue;
        if (assetSet.size > 0 && assetSet.has(target)) continue;
        addIssue(issues, {
          code: "broken-embed",
          severity: "warning",
          docId: doc.id,
          title: `Unresolved gallery asset in ${doc.title}`,
          detail: `The gallery asset "${target}" is not available in the current asset index.`
        });
      }
    }

    if (isLocationLike(doc) && !mapPinDocIds.has(doc.id)) {
      addIssue(issues, {
        code: "missing-map-pin",
        severity: "info",
        docId: doc.id,
        title: `Location has no map pin: ${doc.title}`,
        detail: "This page looks like a location, place, or region but is not pinned on a map."
      });
    }
  }

  for (const doc of activeDocs) {
    if (doc.title === "Welcome" || isIndexDoc(doc)) continue;
    const outgoing = outgoingCounts.get(doc.id) ?? 0;
    const incoming = incomingCounts.get(doc.id) ?? 0;
    if (outgoing === 0 && incoming === 0) {
      addIssue(issues, {
        code: "orphan-doc",
        severity: "info",
        docId: doc.id,
        title: `Orphan page: ${doc.title}`,
        detail: "This page has no wikilinks in or out."
      });
    }
  }

  for (const importError of importErrors) {
    addIssue(issues, {
      code: "import-parse-error",
      severity: "error",
      docId: importError.docId,
      title: importError.title,
      detail: importError.detail
    });
  }

  return {
    issues,
    counts: {
      error: issues.filter((issue) => issue.severity === "error").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length
    }
  };
}
