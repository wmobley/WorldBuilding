import { db } from "../../vault/db";
import type { Doc, Folder } from "../../vault/types";
import { buildWorldContext } from "../context";

export type InvolvedEntity = {
  name: string;
  type: "Faction" | "Person" | "Religion" | "Other";
  relevance: number;
  reason: string;
};

const MAX_RESULTS = 12;

function collectFolderPath(folderId: string | null, folderMap: Map<string, Folder>) {
  const names: string[] = [];
  let current = folderId ? folderMap.get(folderId) ?? null : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) ?? null : null;
  }
  return names.map((name) => name.toLowerCase());
}

function classifyDoc(doc: Doc, folderMap: Map<string, Folder>): InvolvedEntity["type"] {
  const path = collectFolderPath(doc.folderId ?? null, folderMap);
  if (path.includes("factions")) return "Faction";
  if (path.includes("religions")) return "Religion";
  if (path.includes("people") || path.includes("notable figures")) return "Person";
  return "Other";
}

function addCandidate(
  map: Map<
    string,
    { doc: Doc; baseScore: number; reasons: Set<string> }
  >,
  doc: Doc,
  baseScore: number,
  reason: string
) {
  const existing = map.get(doc.id);
  if (existing) {
    existing.baseScore = Math.max(existing.baseScore, baseScore);
    existing.reasons.add(reason);
    return;
  }
  map.set(doc.id, { doc, baseScore, reasons: new Set([reason]) });
}

export async function whoIsInvolved(currentDocId: string): Promise<InvolvedEntity[]> {
  const context = await buildWorldContext(currentDocId);
  if (!context) return [];

  const currentDoc = await db.docs.get(currentDocId);
  if (!currentDoc || currentDoc.deletedAt) return [];

  const folders = await db.folders
    .where("campaignId")
    .equals(currentDoc.campaignId)
    .filter((folder) => !folder.deletedAt)
    .toArray();
  const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));

  const candidates = new Map<
    string,
    { doc: Doc; baseScore: number; reasons: Set<string> }
  >();

  context.linkedDocs.forEach((doc) => {
    addCandidate(candidates, doc, 3, "linked from this page");
  });
  context.backlinks.forEach((doc) => {
    addCandidate(candidates, doc, 2, "links to this page");
  });
  context.relatedDocsByTag.forEach((group) => {
    group.docs.forEach((doc) => {
      addCandidate(candidates, doc, 1, `shares @${group.type}:${group.value}`);
    });
  });

  const sourceDocIds = Array.from(
    new Set([...context.linkedDocs, ...context.backlinks].map((doc) => doc.id))
  );
  if (sourceDocIds.length > 0) {
    const peopleFolders = folders.filter((folder) => {
      const name = folder.name.toLowerCase();
      return name.includes("people") || name.includes("notable figures");
    });
    const peopleFolderIds = peopleFolders.map((folder) => folder.id);
    const peopleDocs =
      peopleFolderIds.length > 0
        ? await db.docs
            .where("folderId")
            .anyOf(peopleFolderIds)
            .filter((doc) => !doc.deletedAt)
            .toArray()
        : ([] as Doc[]);
    const peopleDocIds = new Set(peopleDocs.map((doc) => doc.id));
    const peopleLookup = new Map(peopleDocs.map((doc) => [doc.id, doc]));
    if (peopleDocIds.size > 0) {
      const edges = await db.edges.where("fromDocId").anyOf(sourceDocIds).toArray();
      const sourceLookup = new Map(
        [...context.linkedDocs, ...context.backlinks].map((doc) => [doc.id, doc])
      );
      edges.forEach((edge) => {
        if (!peopleDocIds.has(edge.toDocId)) return;
        const person = peopleLookup.get(edge.toDocId);
        if (!person) return;
        const sourceDoc = sourceLookup.get(edge.fromDocId);
        const reason = sourceDoc
          ? `linked via ${sourceDoc.title}`
          : "linked from nearby context";
        addCandidate(candidates, person, 2, reason);
      });
    }
  }

  if (candidates.size === 0) return [];

  const docs = Array.from(candidates.values()).map((entry) => entry.doc);
  const updatedAtValues = docs.map((doc) => doc.updatedAt);
  const minUpdatedAt = Math.min(...updatedAtValues);
  const maxUpdatedAt = Math.max(...updatedAtValues);

  // TODO: AI could summarize relationships with richer relationship language.
  const results = Array.from(candidates.values()).map((entry) => {
    const recency =
      maxUpdatedAt === minUpdatedAt
        ? 0
        : Math.round(((entry.doc.updatedAt - minUpdatedAt) / (maxUpdatedAt - minUpdatedAt)) * 5);
    const relevance = entry.baseScore * 10 + recency;
    return {
      name: entry.doc.title,
      type: classifyDoc(entry.doc, folderMap),
      relevance,
      reason: Array.from(entry.reasons).join("; ")
    };
  });

  return results
    .sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}
