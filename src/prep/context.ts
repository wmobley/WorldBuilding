import type { Doc, Folder, Tag } from "../vault/types";
import { isIndexDoc } from "../vault/indexing";
import {
  getDocById,
  graphKHopDocs,
  listDocs,
  listDocsByIds,
  listDocsWithTag,
  listFolders,
  listTagsForDoc,
  listTagsForDocs
} from "../vault/queries";

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
  locationTaggedDocs: Doc[];
  docTagsById: Record<string, Tag[]>;
  locationContextTags: string[];
};

const EXCERPT_LIMIT = 420;
const RECENT_LIMIT = 12;
const SIBLING_LIMIT = 12;

function buildExcerpt(body: string, limit = EXCERPT_LIMIT) {
  const withoutLinks = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
  const withoutTags = withoutLinks.replace(/@[a-zA-Z_]+:[\w-]+/g, "");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function sortDocsByTitle(a: Doc, b: Doc) {
  return a.title.localeCompare(b.title);
}

function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function buildWorldContext(currentDocId: string): Promise<WorldContext | null> {
  const currentDoc = await getDocById(currentDocId);
  if (!currentDoc || currentDoc.deletedAt) return null;

  const tags = await listTagsForDoc(currentDocId);
  const outgoing = await graphKHopDocs(currentDoc.campaignId, currentDocId, 1, "out");
  const incoming = await graphKHopDocs(currentDoc.campaignId, currentDocId, 1, "in");

  const linkedDocsRaw = await listDocsByIds(
    outgoing.filter((entry) => entry.hop === 1).map((entry) => entry.docId)
  );
  const linkedDocs = linkedDocsRaw
    .filter((doc): doc is Doc => Boolean(doc && !doc.deletedAt))
    .filter((doc) => !isIndexDoc(doc))
    .sort(sortDocsByTitle);

  const backlinkDocsRaw = await listDocsByIds(
    incoming.filter((entry) => entry.hop === 1).map((entry) => entry.docId)
  );
  const backlinks = backlinkDocsRaw
    .filter((doc): doc is Doc => Boolean(doc && !doc.deletedAt))
    .filter((doc) => !isIndexDoc(doc))
    .sort(sortDocsByTitle);

  const contextTags = Array.from(
    new Map(
      tags
        .filter((tag) =>
          ["terrain", "creature_type", "ecosystem", "creature"].includes(tag.type)
        )
        .map((tag) => [`${tag.type}:${tag.value}`, tag])
    ).values()
  );
  const relatedDocsByTag = await Promise.all(
    contextTags.map(async (tag) => {
      const docs = await listDocsWithTag(tag.type, tag.value, currentDoc.campaignId);
      const filtered = docs
        .filter((doc) => doc.id !== currentDoc.id)
        .filter((doc) => !isIndexDoc(doc))
        .sort(sortDocsByTitle);
      return { type: tag.type, value: tag.value, docs: filtered };
    })
  );

  const locationContext = new Set<string>();
  tags
    .filter((tag) => tag.type === "location")
    .forEach((tag) => locationContext.add(tag.value));
  const typeTags = tags.filter((tag) => tag.type === "type").map((tag) => tag.value);
  const locationTypes = new Set(["location", "settlement", "region", "landmark", "dungeon"]);
  if (typeTags.some((value) => locationTypes.has(value))) {
    const slug = slugifyTitle(currentDoc.title);
    if (slug) locationContext.add(slug);
  }

  const locationTaggedDocs = (
    await Promise.all(
      Array.from(locationContext).map((value) =>
        listDocsWithTag("location", value, currentDoc.campaignId)
      )
    )
  )
    .flat()
    .filter((doc) => doc.id !== currentDoc.id)
    .filter((doc) => !isIndexDoc(doc))
    .sort(sortDocsByTitle);

  const campaignDocs = await listDocs(currentDoc.campaignId);
  const recentlyUpdatedDocs = campaignDocs
    .filter((doc) => !isIndexDoc(doc))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_LIMIT);

  const folders = await listFolders(currentDoc.campaignId);
  const folder = currentDoc.folderId
    ? folders.find((entry) => entry.id === currentDoc.folderId) ?? null
    : null;
  const siblingsRaw = campaignDocs.filter(
    (doc) =>
      doc.id !== currentDoc.id && doc.folderId === (currentDoc.folderId ?? null)
  );
  const siblings = siblingsRaw
    .filter((doc) => !isIndexDoc(doc))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || sortDocsByTitle(a, b))
    .slice(0, SIBLING_LIMIT);

  const involvedDocIds = Array.from(
    new Set([
      ...linkedDocs.map((doc) => doc.id),
      ...backlinks.map((doc) => doc.id),
      ...locationTaggedDocs.map((doc) => doc.id)
    ])
  );
  const involvedTags = await listTagsForDocs(involvedDocIds);
  const docTagsById: Record<string, Tag[]> = {};
  for (const tag of involvedTags) {
    if (!docTagsById[tag.docId]) docTagsById[tag.docId] = [];
    docTagsById[tag.docId].push(tag);
  }

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
    folderContext: { folder: folder ?? null, siblings },
    locationTaggedDocs,
    docTagsById,
    locationContextTags: Array.from(locationContext)
  };
}
