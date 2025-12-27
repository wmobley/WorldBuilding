import type { Folder, Tag } from "../../vault/types";
import { buildWorldContext } from "../context";
import { getDocById, listFolders, listTagsForDocs } from "../../vault/queries";

export type EncounterSuggestion = {
  environment: string;
  creatureTags: string[];
  factions: string[];
  figures: string[];
  reason: string;
};

const MAX_SUGGESTIONS = 5;
const MAX_LIST = 4;

function formatTagValue(value: string) {
  return value
    .split("-")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function toTitleList(values: string[]) {
  return values.map((value) => formatTagValue(value));
}

function collectFolderPath(folderId: string | null, folderMap: Map<string, Folder>) {
  const names: string[] = [];
  let current = folderId ? folderMap.get(folderId) ?? null : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) ?? null : null;
  }
  return names.map((name) => name.toLowerCase());
}

function uniqueNames(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()))).filter(Boolean);
}

export async function suggestEncounter(
  currentDocId: string
): Promise<EncounterSuggestion[]> {
  const context = await buildWorldContext(currentDocId);
  if (!context) return [];

  const currentDoc = await getDocById(currentDocId);
  if (!currentDoc || currentDoc.deletedAt) return [];

  const folders = await listFolders(currentDoc.campaignId);
  const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));

  const ecosystemTags = context.currentDoc.tags
    .filter((tag) => tag.type === "ecosystem")
    .map((tag) => tag.value);
  const creatureTagsRaw = context.currentDoc.tags
    .filter((tag) => tag.type === "creature")
    .map((tag) => tag.value);

  const relatedDocs = [
    ...context.linkedDocs,
    ...context.backlinks,
    ...context.relatedDocsByTag.flatMap((entry) => entry.docs)
  ].filter((doc) => doc.id !== context.currentDoc.id);
  const relatedDocIds = Array.from(new Set(relatedDocs.map((doc) => doc.id)));

  const relatedTags =
    relatedDocIds.length > 0
      ? await listTagsForDocs(relatedDocIds)
      : ([] as Tag[]);

  const creatureTags =
    creatureTagsRaw.length > 0
      ? uniqueNames(creatureTagsRaw)
      : uniqueNames(relatedTags.filter((tag) => tag.type === "creature").map((tag) => tag.value));

  const factionDocs = relatedDocs.filter((doc) => {
    const path = collectFolderPath(doc.folderId ?? null, folderMap);
    return path.includes("factions");
  });
  const figureDocs = relatedDocs.filter((doc) => {
    const path = collectFolderPath(doc.folderId ?? null, folderMap);
    return path.includes("people") || path.includes("notable figures");
  });

  const factions = uniqueNames(factionDocs.map((doc) => doc.title)).slice(0, MAX_LIST);
  const figures = uniqueNames(figureDocs.map((doc) => doc.title)).slice(0, MAX_LIST);

  const environmentCandidates: Array<{ environment: string; reason: string }> = [];
  if (ecosystemTags.length > 0) {
    ecosystemTags.forEach((tagValue) => {
      const relatedMatch = context.relatedDocsByTag.find(
        (entry) => entry.type === "ecosystem" && entry.value === tagValue && entry.docs.length > 0
      );
      const relatedDoc = relatedMatch?.docs[0];
      const reason = relatedDoc
        ? `shares @ecosystem:${tagValue} with ${relatedDoc.title}`
        : `tagged @ecosystem:${tagValue} on this page`;
      environmentCandidates.push({ environment: tagValue, reason });
    });
  } else {
    const fallbackTags = relatedTags.filter((tag) => tag.type === "ecosystem");
    if (fallbackTags.length > 0) {
      uniqueNames(fallbackTags.map((tag) => tag.value))
        .slice(0, MAX_SUGGESTIONS)
        .forEach((tagValue) => {
          environmentCandidates.push({
            environment: tagValue,
            reason: `appears on linked context as @ecosystem:${tagValue}`
          });
        });
    }
  }

  if (environmentCandidates.length === 0) {
    context.linkedDocs.slice(0, MAX_SUGGESTIONS).forEach((doc) => {
      environmentCandidates.push({
        environment: doc.title,
        reason: `linked to ${doc.title}`
      });
    });
  }

  if (environmentCandidates.length === 0) {
    environmentCandidates.push({
      environment: "local area",
      reason: "no ecosystem tags detected"
    });
  }

  const limitedCandidates = environmentCandidates.slice(0, MAX_SUGGESTIONS);

  // TODO: AI could enrich factions/figures with additional local context.
  return limitedCandidates.map((candidate) => ({
    environment: formatTagValue(candidate.environment),
    creatureTags: toTitleList(creatureTags),
    factions,
    figures,
    reason: candidate.reason
  }));
}
