import { db } from "./db";
import type {
  Campaign,
  Doc,
  Folder,
  MapLocation,
  NpcProfile,
  DmScreenCard,
  ReferenceEntry,
  SessionNotes,
  Tag,
  WorldMap
} from "./types";
import { createId } from "../lib/id";
import { parseLinks, parseTags } from "./parser";
import { INDEX_END, INDEX_START, isIndexDoc } from "./indexing";

export async function listFolders(campaignId: string) {
  return db.folders
    .where("campaignId")
    .equals(campaignId)
    .filter((folder) => !folder.deletedAt)
    .toArray();
}

export async function listDocs(campaignId: string) {
  return db.docs
    .where("campaignId")
    .equals(campaignId)
    .filter((doc) => !doc.deletedAt)
    .toArray();
}

export async function getDocById(docId: string) {
  return db.docs.get(docId);
}

export async function getDocByTitle(title: string, campaignId: string) {
  return db.docs
    .where("campaignId")
    .equals(campaignId)
    .filter((doc) => !doc.deletedAt && doc.title.toLowerCase() === title.toLowerCase())
    .first();
}

export async function createFolder(
  name: string,
  parentFolderId: string | null = null,
  campaignId: string,
  createIndexDoc = true
) {
  const folder: Folder = {
    id: createId(),
    name,
    parentFolderId,
    campaignId,
    deletedAt: null
  };
  await db.folders.add(folder);
  if (createIndexDoc) {
    await ensureIndexDoc(folder, campaignId);
  }
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const folder = await db.folders.get(folderId);
  if (!folder) return;
  await db.folders.update(folderId, { name });
  const nextTitle = `${name} Index`;
  const indexDoc = await ensureIndexDoc({ ...folder, name }, folder.campaignId);
  if (indexDoc) {
    const nextBody = buildIndexBody(indexDoc.body, name, []);
    await db.docs.update(indexDoc.id, { title: nextTitle, body: nextBody });
  }
}

async function collectFolderTreeIds(folderId: string) {
  const children = await db.folders.where("parentFolderId").equals(folderId).toArray();
  const childIds = await Promise.all(children.map((child) => collectFolderTreeIds(child.id)));
  return [folderId, ...childIds.flat()];
}

export async function trashFolder(folderId: string) {
  const now = Date.now();
  const folderIds = await collectFolderTreeIds(folderId);
  await db.transaction("rw", db.folders, db.docs, async () => {
    await Promise.all(
      folderIds.map((id) => db.folders.update(id, { deletedAt: now }))
    );
    await db.docs
      .where("folderId")
      .anyOf(folderIds)
      .modify({ deletedAt: now });
  });
}

export async function restoreFolder(folderId: string) {
  const folderIds = await collectFolderTreeIds(folderId);
  const folders = await db.folders.bulkGet(folderIds);
  await db.transaction("rw", db.folders, db.docs, async () => {
    for (const folder of folders) {
      if (!folder) continue;
      const parent = folder.parentFolderId
        ? await db.folders.get(folder.parentFolderId)
        : null;
      const nextParentId = parent && !parent.deletedAt ? folder.parentFolderId : null;
      await db.folders.update(folder.id, { deletedAt: null, parentFolderId: nextParentId });
    }
    await db.docs
      .where("folderId")
      .anyOf(folderIds)
      .modify({ deletedAt: null });
  });
}

export async function purgeFolder(folderId: string) {
  const folderIds = await collectFolderTreeIds(folderId);
  const docs = await db.docs.where("folderId").anyOf(folderIds).toArray();
  const docIds = docs.map((doc) => doc.id);
  await db.transaction(
    "rw",
    db.docs,
    db.folders,
    db.edges,
    db.tags,
    db.npcProfiles,
    db.mapLocations,
    async () => {
      if (docIds.length > 0) {
        await db.edges.where("fromDocId").anyOf(docIds).delete();
        await db.edges.where("toDocId").anyOf(docIds).delete();
        await db.tags.where("docId").anyOf(docIds).delete();
        await db.npcProfiles.where("docId").anyOf(docIds).delete();
        await db.mapLocations.where("docId").anyOf(docIds).delete();
        await db.docs.bulkDelete(docIds);
      }
      await db.folders.bulkDelete(folderIds);
    }
  );
}

export async function deleteFolder(folderId: string) {
  await trashFolder(folderId);
}

export async function createDoc(
  title: string,
  folderId: string | null = null,
  campaignId: string
) {
  const now = Date.now();
  const sortIndex = await getNextDocSortIndex(folderId, campaignId);
  const doc: Doc = {
    id: createId(),
    folderId,
    title: title || "Untitled Page",
    body: "",
    updatedAt: now,
    campaignId,
    sortIndex,
    deletedAt: null
  };
  await db.docs.add(doc);
  return doc;
}

export async function renameDoc(docId: string, title: string) {
  await db.docs.update(docId, { title: title || "Untitled Page" });
}

export async function moveDoc(
  docId: string,
  folderId: string | null,
  sortIndex?: number
) {
  const doc = await db.docs.get(docId);
  if (!doc) return;
  const nextSort =
    typeof sortIndex === "number"
      ? sortIndex
      : await getNextDocSortIndex(folderId, doc.campaignId);
  await db.docs.update(docId, { folderId, sortIndex: nextSort });
}

export async function setDocSortOrder(
  folderId: string | null,
  campaignId: string,
  orderedDocIds: string[]
) {
  await db.transaction("rw", db.docs, async () => {
    const updates = orderedDocIds.map((id, index) =>
      db.docs.update(id, { sortIndex: index + 1, folderId })
    );
    await Promise.all(updates);
  });
}

export async function trashDoc(docId: string) {
  const now = Date.now();
  await db.docs.update(docId, { deletedAt: now });
}

export async function restoreDoc(docId: string) {
  const doc = await db.docs.get(docId);
  if (!doc) return;
  let nextFolderId = doc.folderId;
  if (nextFolderId) {
    const folder = await db.folders.get(nextFolderId);
    if (!folder || folder.deletedAt) {
      nextFolderId = null;
    }
  }
  await db.docs.update(docId, {
    deletedAt: null,
    folderId: nextFolderId,
    sortIndex: await getNextDocSortIndex(nextFolderId, doc.campaignId)
  });
}

export async function purgeDoc(docId: string) {
  await db.transaction(
    "rw",
    db.docs,
    db.edges,
    db.tags,
    db.npcProfiles,
    db.mapLocations,
    async () => {
      await db.edges.where("fromDocId").equals(docId).delete();
      await db.edges.where("toDocId").equals(docId).delete();
      await db.tags.where("docId").equals(docId).delete();
      await db.npcProfiles.delete(docId);
      await db.mapLocations.where("docId").equals(docId).delete();
      await db.docs.delete(docId);
    }
  );
}

export async function saveDocContent(docId: string, body: string) {
  const doc = await db.docs.get(docId);
  if (!doc) return;
  const updatedAt = Date.now();
  await db.docs.update(docId, { body, updatedAt });

  const parsedLinks = parseLinks(body);
  const parsedTags = parseTags(body);

  const uniqueLinks = new Map<string, { linkText: string; docId?: string }>();
  parsedLinks.forEach((link) => {
    uniqueLinks.set(link.targetTitle, { linkText: link.linkText, docId: link.docId });
  });

  await db.edges.where("fromDocId").equals(docId).delete();

  for (const [targetTitle, payload] of uniqueLinks) {
    const linkText = payload.linkText;
    if (payload.docId) {
      const target = await db.docs.get(payload.docId);
      if (!target) continue;
      await db.edges.add({
        fromDocId: docId,
        toDocId: target.id,
        linkText
      });
      continue;
    }
    let target = await getDocByTitle(targetTitle, doc.campaignId);
    if (!target) {
      target = await createDoc(targetTitle, null, doc.campaignId);
    }
    await db.edges.add({
      fromDocId: docId,
      toDocId: target.id,
      linkText
    });
  }

  await db.tags.where("docId").equals(docId).delete();
  if (parsedTags.length > 0) {
    const tags: Tag[] = parsedTags.map((tag) => ({
      docId,
      type: tag.type,
      value: tag.value
    }));
    await db.tags.bulkAdd(tags);
  }
}

export async function listBacklinks(docId: string) {
  const edges = await db.edges.where("toDocId").equals(docId).toArray();
  const sourceDocs = await db.docs.bulkGet(edges.map((edge) => edge.fromDocId));
  return edges
    .map((edge) => {
      const source = sourceDocs.find((doc) => doc?.id === edge.fromDocId);
      if (!source) return null;
      return {
        edge,
        source
      };
    })
    .filter(Boolean)
    .filter((entry) => !entry.source.deletedAt);
}

export async function listTagsForDoc(docId: string) {
  return db.tags.where("docId").equals(docId).toArray();
}

export async function listDocsWithTag(type: string, value: string, campaignId: string) {
  const tags = await db.tags
    .where("type")
    .equals(type)
    .and((tag) => tag.value === value)
    .toArray();
  const docIds = tags.map((tag) => tag.docId);
  if (docIds.length === 0) return [];
  return db.docs
    .where("id")
    .anyOf(docIds)
    .filter((doc) => doc.campaignId === campaignId && !doc.deletedAt)
    .toArray();
}

export async function searchDocsByTitle(query: string, campaignId: string) {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  return db.docs
    .filter(
      (doc) =>
        doc.campaignId === campaignId &&
        !doc.deletedAt &&
        doc.title.toLowerCase().includes(lower)
    )
    .toArray();
}

export async function getSetting(key: string) {
  const setting = await db.settings.get(key);
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value });
}

export async function getSessionNotes(roomId: string) {
  return db.sessionNotes.get(roomId);
}

export async function saveSessionNotes(
  roomId: string,
  updates: Omit<SessionNotes, "roomId" | "createdAt"> & {
    createdAt?: number;
  }
) {
  const existing = await db.sessionNotes.get(roomId);
  const now = Date.now();
  if (existing) {
    await db.sessionNotes.update(roomId, { ...updates, updatedAt: now });
    return;
  }
  const next: SessionNotes = {
    roomId,
    roomName: updates.roomName,
    campaignId: updates.campaignId ?? null,
    content: updates.content,
    createdAt: updates.createdAt ?? now,
    updatedAt: now
  };
  await db.sessionNotes.add(next);
}

export async function listCampaigns() {
  return db.campaigns.orderBy("updatedAt").reverse().toArray();
}

export async function getCampaignById(id: string) {
  return db.campaigns.get(id);
}

export async function createCampaign(name: string, synopsis = "") {
  const now = Date.now();
  const campaign: Campaign = {
    id: createId(),
    name: name || "Untitled Campaign",
    synopsis,
    createdAt: now,
    updatedAt: now
  };
  await db.campaigns.add(campaign);
  return campaign;
}

export async function updateCampaign(campaignId: string, updates: Partial<Campaign>) {
  await db.campaigns.update(campaignId, { ...updates, updatedAt: Date.now() });
}

function renderIndexSection(items: string[]) {
  if (items.length === 0) return "- (No pages yet)";
  return items.map((title) => `- [[${title}]]`).join("\n");
}

function buildIndexBody(existingBody: string, folderName: string, items: string[]) {
  const marker = `${INDEX_START}\n${renderIndexSection(items)}\n${INDEX_END}`;
  if (existingBody.includes(INDEX_START) && existingBody.includes(INDEX_END)) {
    const regex = new RegExp(`${INDEX_START}[\\s\\S]*?${INDEX_END}`);
    return existingBody.replace(regex, marker).trim();
  }
  const intro = `# ${folderName} Index\n\n> A living index of pages within this chapter.\n\n`;
  return `${intro}${marker}`.trim();
}

async function ensureIndexDoc(folder: Folder, campaignId: string) {
  const title = `${folder.name} Index`;
  const existing = await db.docs
    .where("campaignId")
    .equals(campaignId)
    .and((doc) => doc.folderId === folder.id)
    .toArray();
  const candidates = existing.filter((doc) => isIndexDoc(doc));
  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  const doc: Doc = {
    id: createId(),
    folderId: folder.id,
    title,
    body: buildIndexBody("", folder.name, []),
    updatedAt: Date.now(),
    campaignId,
    sortIndex: await getNextDocSortIndex(folder.id, campaignId),
    deletedAt: null
  };
  await db.docs.add(doc);
  return doc;
}

export async function updateAllFolderIndexes(campaignId: string) {
  const folders = await db.folders
    .where("campaignId")
    .equals(campaignId)
    .filter((folder) => !folder.deletedAt)
    .toArray();
  const docs = await db.docs
    .where("campaignId")
    .equals(campaignId)
    .filter((doc) => !doc.deletedAt)
    .toArray();

  const folderMap = new Map<string | null, Folder[]>();
  folders.forEach((folder) => {
    const key = folder.parentFolderId ?? null;
    const list = folderMap.get(key) ?? [];
    list.push(folder);
    folderMap.set(key, list);
  });

  const docMap = new Map<string | null, Doc[]>();
  docs.forEach((doc) => {
    const key = doc.folderId ?? null;
    const list = docMap.get(key) ?? [];
    list.push(doc);
    docMap.set(key, list);
  });

  const collectDescendants = (folderId: string): string[] => {
    const children = folderMap.get(folderId) ?? [];
    return children.flatMap((child) => [child.id, ...collectDescendants(child.id)]);
  };

  for (const folder of folders) {
    const indexDoc = await ensureIndexDoc(folder, campaignId);
    const descendantIds = [folder.id, ...collectDescendants(folder.id)];
    const titles = descendantIds
      .flatMap((id) => docMap.get(id) ?? [])
      .filter((doc) => doc.id !== indexDoc.id && !isIndexDoc(doc))
      .sort((a, b) => {
        const order = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
        if (order !== 0) return order;
        return a.title.localeCompare(b.title);
      })
      .map((doc) => doc.title);

    const nextBody = buildIndexBody(indexDoc.body, folder.name, titles);
    if (nextBody !== indexDoc.body) {
      await saveDocContent(indexDoc.id, nextBody);
    }
  }
}

export async function listTrashedDocs(campaignId: string) {
  return db.docs
    .where("campaignId")
    .equals(campaignId)
    .filter((doc) => Boolean(doc.deletedAt))
    .toArray();
}

export async function listTrashedFolders(campaignId: string) {
  return db.folders
    .where("campaignId")
    .equals(campaignId)
    .filter((folder) => Boolean(folder.deletedAt))
    .toArray();
}

async function getNextDocSortIndex(folderId: string | null, campaignId: string) {
  const docs = await db.docs
    .where("campaignId")
    .equals(campaignId)
    .filter((doc) => doc.folderId === folderId && !doc.deletedAt)
    .toArray();
  const max = docs.reduce((acc, doc) => Math.max(acc, doc.sortIndex ?? 0), 0);
  return max + 1;
}

export async function listReferencesBySlug(slug: string) {
  return db.references.where("slug").equals(slug).sortBy("name");
}

export async function getReferenceById(id: string) {
  return db.references.get(id);
}

export async function searchReferences(slug: string, query: string) {
  const lower = query.toLowerCase();
  const results = await db.references.where("slug").equals(slug).toArray();
  return results.filter((item) => item.name.toLowerCase().includes(lower));
}

export async function getNpcProfile(docId: string) {
  return db.npcProfiles.get(docId);
}

export async function setNpcProfile(docId: string, creatureId: string | null) {
  const existing = await db.npcProfiles.get(docId);
  if (existing) {
    await db.npcProfiles.update(docId, { creatureId, updatedAt: Date.now() });
    return;
  }
  const profile: NpcProfile = {
    docId,
    creatureId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.npcProfiles.add(profile);
}

export async function listDmScreenCards(campaignId: string) {
  return db.dmScreenCards.where("campaignId").equals(campaignId).toArray();
}

export async function createDmScreenCard(
  campaignId: string,
  kind: "doc" | "reference",
  entryId: string,
  column = 0,
  position = 0
) {
  const now = Date.now();
  const card: DmScreenCard = {
    campaignId,
    kind,
    entryId,
    column,
    position,
    createdAt: now,
    updatedAt: now
  };
  return db.dmScreenCards.add(card);
}

export async function updateDmScreenCard(
  cardId: number,
  updates: Partial<Omit<DmScreenCard, "id" | "campaignId">>
) {
  await db.dmScreenCards.update(cardId, { ...updates, updatedAt: Date.now() });
}

export async function deleteDmScreenCard(cardId: number) {
  await db.dmScreenCards.delete(cardId);
}

export async function listMaps(campaignId: string) {
  return db.maps.where("campaignId").equals(campaignId).sortBy("updatedAt");
}

export async function createMap(name: string, imageDataUrl: string, campaignId: string) {
  const now = Date.now();
  const map: WorldMap = {
    id: createId(),
    campaignId,
    name: name || "Untitled Map",
    imageDataUrl,
    createdAt: now,
    updatedAt: now
  };
  await db.maps.add(map);
  return map;
}

export async function updateMap(mapId: string, updates: Partial<WorldMap>) {
  await db.maps.update(mapId, { ...updates, updatedAt: Date.now() });
}

export async function deleteMap(mapId: string) {
  await db.mapLocations.where("mapId").equals(mapId).delete();
  await db.maps.delete(mapId);
}

export async function listMapLocations(mapId: string) {
  return db.mapLocations.where("mapId").equals(mapId).toArray();
}

export async function createMapLocation(mapId: string, docId: string, x: number, y: number) {
  const location: MapLocation = {
    mapId,
    docId,
    x,
    y,
    createdAt: Date.now()
  };
  await db.mapLocations.add(location);
  return location;
}

export async function deleteMapLocation(id: number) {
  await db.mapLocations.delete(id);
}
