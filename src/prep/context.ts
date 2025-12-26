import { db } from "../vault/db";
import type { Doc, Folder, Tag } from "../vault/types";
import { isIndexDoc } from "../vault/indexing";

export type WorldContext = {
  currentDoc: {
    id: string;
    title: string;
    tags: Tag[];
    excerpt: string;
    folderId: string | null;
    campaignId: string;
  };
  linkedDocs: Doc[];
  backlinks: Doc[];
  relatedDocsByTag: Array<{ type: string; value: string; docs: Doc[] }>;
  recentlyUpdatedDocs: Doc[];
  folderContext: { folder: Folder | null; siblings: Doc[] };
};

const EXCERPT_LIMIT = 420;
const RECENT_LIMIT = 12;
const SIBLING_LIMIT = 12;

function buildExcerpt(body: string, limit = EXCERPT_LIMIT) {
  const withoutLinks = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
  const withoutTags = withoutLinks.replace(/@[a-zA-Z]+:[\w-]+/g, "");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function sortDocsByTitle(a: Doc, b: Doc) {
  return a.title.localeCompare(b.title);
}

export async function buildWorldContext(currentDocId: string): Promise<WorldContext | null> {
  const currentDoc = await db.docs.get(currentDocId);
  if (!currentDoc || currentDoc.deletedAt) return null;

  const tags = await db.tags.where("docId").equals(currentDocId).toArray();
  const outgoingEdges = await db.edges.where("fromDocId").equals(currentDocId).toArray();
  const incomingEdges = await db.edges.where("toDocId").equals(currentDocId).toArray();

  const linkedDocsRaw = await db.docs.bulkGet(outgoingEdges.map((edge) => edge.toDocId));
  const linkedDocs = linkedDocsRaw
    .filter((doc): doc is Doc => Boolean(doc && !doc.deletedAt))
    .filter((doc) => !isIndexDoc(doc))
    .sort(sortDocsByTitle);

  const backlinkDocsRaw = await db.docs.bulkGet(incomingEdges.map((edge) => edge.fromDocId));
  const backlinks = backlinkDocsRaw
    .filter((doc): doc is Doc => Boolean(doc && !doc.deletedAt))
    .filter((doc) => !isIndexDoc(doc))
    .sort(sortDocsByTitle);

  const contextTags = Array.from(
    new Map(
      tags
        .filter((tag) => ["ecosystem", "creature"].includes(tag.type))
        .map((tag) => [`${tag.type}:${tag.value}`, tag])
    ).values()
  );
  const relatedDocsByTag = await Promise.all(
    contextTags.map(async (tag) => {
      const relatedTags = await db.tags
        .where("type")
        .equals(tag.type)
        .and((entry) => entry.value === tag.value)
        .toArray();
      const docIds = relatedTags.map((entry) => entry.docId);
      const relatedDocsRaw = await db.docs.bulkGet(docIds);
      const docs = relatedDocsRaw
        .filter((doc): doc is Doc => Boolean(doc && !doc.deletedAt))
        .filter((doc) => doc.campaignId === currentDoc.campaignId && doc.id !== currentDoc.id)
        .filter((doc) => !isIndexDoc(doc))
        .sort(sortDocsByTitle);
      return { type: tag.type, value: tag.value, docs };
    })
  );

  const campaignDocs = await db.docs
    .where("campaignId")
    .equals(currentDoc.campaignId)
    .filter((doc) => !doc.deletedAt)
    .toArray();
  const recentlyUpdatedDocs = campaignDocs
    .filter((doc) => !isIndexDoc(doc))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_LIMIT);

  const folder = currentDoc.folderId ? await db.folders.get(currentDoc.folderId) : null;
  const siblingsRaw = await db.docs
    .where("campaignId")
    .equals(currentDoc.campaignId)
    .filter(
      (doc) =>
        !doc.deletedAt &&
        doc.id !== currentDoc.id &&
        doc.folderId === (currentDoc.folderId ?? null)
    )
    .toArray();
  const siblings = siblingsRaw
    .filter((doc) => !isIndexDoc(doc))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || sortDocsByTitle(a, b))
    .slice(0, SIBLING_LIMIT);

  return {
    currentDoc: {
      id: currentDoc.id,
      title: currentDoc.title,
      tags,
      excerpt: buildExcerpt(currentDoc.body ?? ""),
      folderId: currentDoc.folderId ?? null,
      campaignId: currentDoc.campaignId
    },
    linkedDocs,
    backlinks,
    relatedDocsByTag,
    recentlyUpdatedDocs,
    folderContext: { folder: folder ?? null, siblings }
  };
}
