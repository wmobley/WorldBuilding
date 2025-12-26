import type { WorldContext } from "../prep/context";
import type { Doc, Tag } from "../vault/types";

export type WorldbuildAnchorType = "Faction" | "Religion" | "Region" | "Figure" | "Other";

export type WorldbuildAnchor = {
  id: string;
  title: string;
  type: WorldbuildAnchorType;
  reason?: string;
};

export type WorldbuildDraft = {
  title: string;
  folderHint: "World" | "Places" | "People" | "Lore" | "Other";
  bodyMarkdown: string;
  linksTo: string[];
  tags: string[];
};

export type WorldbuildResult = {
  id: string;
  kind: "plotLines" | "cityBuilder" | "adventureHooks" | "highLevelPlot";
  provider: string;
  contextPreview: string;
  content: string;
  createdAt: number;
  drafts?: WorldbuildDraft[];
  status?: "ready" | "sending" | "error";
  error?: string;
};

const EXCERPT_LIMIT = 240;
const DOC_LIMIT = 6;
const RECENT_LIMIT = 6;

function buildExcerpt(body: string, limit = EXCERPT_LIMIT) {
  const withoutLinks = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
  const withoutTags = withoutLinks.replace(/@[a-zA-Z]+:[\w-]+/g, "");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function toPromptDoc(doc: Doc) {
  return {
    id: doc.id,
    title: doc.title,
    excerpt: buildExcerpt(doc.body ?? "")
  };
}

function toTagLabel(tag: Tag) {
  return `@${tag.type}:${tag.value}`;
}

export function buildWorldbuildInputs(
  context: WorldContext,
  anchors: WorldbuildAnchor[],
  tone: string
) {
  return {
    worldContext: {
      currentDoc: {
        id: context.currentDoc.id,
        title: context.currentDoc.title,
        tags: context.currentDoc.tags.map(toTagLabel),
        excerpt: context.currentDoc.excerpt
      },
      linkedDocs: context.linkedDocs.slice(0, DOC_LIMIT).map(toPromptDoc),
      backlinks: context.backlinks.slice(0, DOC_LIMIT).map(toPromptDoc),
      relatedDocsByTag: context.relatedDocsByTag.map((entry) => ({
        tag: `@${entry.type}:${entry.value}`,
        docs: entry.docs.slice(0, DOC_LIMIT).map(toPromptDoc)
      })),
      recentlyUpdatedDocs: context.recentlyUpdatedDocs.slice(0, RECENT_LIMIT).map((doc) => ({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt
      })),
      folderContext: {
        folder: context.folderContext.folder
          ? { id: context.folderContext.folder.id, name: context.folderContext.folder.name }
          : null,
        siblings: context.folderContext.siblings.slice(0, DOC_LIMIT).map(toPromptDoc)
      }
    },
    selectedAnchors: anchors.map((anchor) => ({
      id: anchor.id,
      title: anchor.title,
      type: anchor.type
    })),
    tone: tone.trim() || "neutral"
  };
}

export function buildWorldbuildPrompt(template: string, inputs: unknown) {
  return `${template.trim()}\n\n## Inputs\n\`\`\`json\n${JSON.stringify(inputs, null, 2)}\n\`\`\`\n`;
}

export function buildWorldbuildContextPreview(
  context: WorldContext,
  anchors: WorldbuildAnchor[]
) {
  const tags = context.currentDoc.tags.map(toTagLabel);
  const linked = context.linkedDocs.slice(0, 4).map((doc) => doc.title);
  const backlinks = context.backlinks.slice(0, 4).map((doc) => doc.title);
  const anchorTitles = anchors.slice(0, 4).map((anchor) => anchor.title);
  const recent = context.recentlyUpdatedDocs.slice(0, 3).map((doc) => doc.title);
  return [
    `Current: ${context.currentDoc.title}`,
    `Tags: ${tags.length > 0 ? tags.join(", ") : "None"}`,
    `Anchors: ${anchorTitles.length > 0 ? anchorTitles.join(", ") : "None"}`,
    `Linked: ${linked.length > 0 ? linked.join(", ") : "None"}`,
    `Backlinks: ${backlinks.length > 0 ? backlinks.join(", ") : "None"}`,
    `Recent: ${recent.length > 0 ? recent.join(", ") : "None"}`
  ].join(" | ");
}

export function parseWorldbuildDrafts(content: string): WorldbuildDraft[] | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { drafts?: WorldbuildDraft[] };
    if (!parsed.drafts || !Array.isArray(parsed.drafts)) return null;
    const drafts = parsed.drafts
      .filter(
        (draft) =>
          draft &&
          typeof draft.title === "string" &&
          typeof draft.folderHint === "string" &&
          typeof draft.bodyMarkdown === "string"
      )
      .map((draft) => ({
        ...draft,
        linksTo: Array.isArray(draft.linksTo) ? draft.linksTo : [],
        tags: Array.isArray(draft.tags) ? draft.tags : []
      })) as WorldbuildDraft[];
    return drafts.length > 0 ? drafts : null;
  } catch {
    return null;
  }
}
