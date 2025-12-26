import { db } from "../../vault/db";
import type { Doc, Folder } from "../../vault/types";
import { buildWorldContext } from "../context";
import { isIndexDoc } from "../../vault/indexing";

export type RecentChange = {
  docTitle: string;
  lastUpdated: string;
  impactedEntities: string[];
  reason: string;
};

const MAX_RESULTS = 8;
const MIN_BODY_LENGTH = 80;

function collectFolderPath(folderId: string | null, folderMap: Map<string, Folder>) {
  const names: string[] = [];
  let current = folderId ? folderMap.get(folderId) ?? null : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) ?? null : null;
  }
  return names.map((name) => name.toLowerCase());
}

function scoreDoc(doc: Doc, folderMap: Map<string, Folder>, linkedIds: Set<string>) {
  const path = collectFolderPath(doc.folderId ?? null, folderMap);
  const bias = {
    faction: path.includes("factions"),
    religion: path.includes("religions"),
    linked: linkedIds.has(doc.id)
  };
  const biasScore = (bias.faction ? 2 : 0) + (bias.religion ? 2 : 0) + (bias.linked ? 1 : 0);
  // Small offset keeps ordering mostly tied to updatedAt while favoring key areas.
  const score = doc.updatedAt + biasScore * 60 * 60 * 1000;
  const reasons = ["updated recently"];
  if (bias.faction) reasons.push("in Factions folder");
  if (bias.religion) reasons.push("in Religions folder");
  if (bias.linked) reasons.push("linked to current page");
  return { score, reason: reasons.join("; ") };
}

export async function whatChangedRecently(
  currentDocId: string
): Promise<RecentChange[]> {
  const context = await buildWorldContext(currentDocId);
  if (!context) return [];

  const currentDoc = await db.docs.get(currentDocId);
  if (!currentDoc || currentDoc.deletedAt) return [];

  const [folders, docs] = await Promise.all([
    db.folders
      .where("campaignId")
      .equals(currentDoc.campaignId)
      .filter((folder) => !folder.deletedAt)
      .toArray(),
    db.docs
      .where("campaignId")
      .equals(currentDoc.campaignId)
      .filter((doc) => !doc.deletedAt && !isIndexDoc(doc))
      .toArray()
  ]);

  const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));
  const linkedIds = new Set([
    ...context.linkedDocs.map((doc) => doc.id),
    ...context.backlinks.map((doc) => doc.id)
  ]);

  const filteredDocs = docs.filter(
    (doc) => (doc.body ?? "").trim().length >= MIN_BODY_LENGTH
  );

  const ranked = filteredDocs
    .map((doc) => ({ doc, ...scoreDoc(doc, folderMap, linkedIds) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const rankedDocIds = ranked.map((entry) => entry.doc.id);
  const edges =
    rankedDocIds.length > 0
      ? await db.edges.where("fromDocId").anyOf(rankedDocIds).toArray()
      : [];
  const edgeTargets = await db.docs.bulkGet(edges.map((edge) => edge.toDocId));
  const targetLookup = new Map(
    edgeTargets.filter(Boolean).map((doc) => [doc!.id, doc!])
  );

  // TODO: AI could summarize doc changes into natural-language impact notes.
  return ranked.map((entry) => {
    const impacted = edges
      .filter((edge) => edge.fromDocId === entry.doc.id)
      .map((edge) => targetLookup.get(edge.toDocId)?.title)
      .filter(Boolean) as string[];
    const impactedEntities = Array.from(new Set(impacted)).slice(0, 3);
    return {
      docTitle: entry.doc.title,
      lastUpdated: new Date(entry.doc.updatedAt).toISOString(),
      impactedEntities,
      reason: entry.reason
    };
  });
}
