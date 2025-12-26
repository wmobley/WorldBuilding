import { db } from "./db";
import { createId } from "../lib/id";
import { saveDocContent, updateAllFolderIndexes } from "./queries";
import type { Doc, Folder } from "./types";

const seedDocs = [
  {
    folder: null,
    title: "Welcome",
    body:
      "Worldbuilder is a spellbook of systems, not a list of records. Start with the forces that shape everything, then let people and places emerge.\n\nBegin with [[folder:Factions]], [[folder:Religions]], [[folder:Regions]], [[folder:Magic & Cosmology]], and [[folder:History & Ages]].\n\nTags capture context like @ecosystem:coastal or @creature:undead."
  }
];

const indexStructure = [
  { parent: "Places", children: ["Regions"] },
  { parent: "People", children: ["Notable Figures"] },
  { parent: "Lore", children: ["Myths & Legends"] }
];

const topLevelFolders = [
  "Factions",
  "Religions",
  "Magic & Cosmology",
  "History & Ages",
  "Places",
  "Lore",
  "People"
];

const seedPromises = new Map<string, Promise<void>>();

export async function seedCampaignIfNeeded(campaignId: string) {
  if (seedPromises.has(campaignId)) return seedPromises.get(campaignId);

  const promise = (async () => {
    const existing = await db.docs.where("campaignId").equals(campaignId).count();
    if (existing > 0) return;

    const folderMap = new Map<string, Folder>();
    const folderNames = Array.from(new Set(topLevelFolders));

    await db.transaction("rw", db.folders, db.docs, async () => {
      for (const name of folderNames) {
       const folder: Folder = {
          id: createId(),
          name,
          parentFolderId: null,
          campaignId,
          deletedAt: null
        };
        folderMap.set(name, folder);
        await db.folders.add(folder);
      }

      for (const entry of seedDocs) {
       const doc: Doc = {
          id: createId(),
          folderId: entry.folder ? folderMap.get(entry.folder)?.id ?? null : null,
          title: entry.title,
          body: entry.body,
          updatedAt: Date.now(),
          campaignId,
          sortIndex: Date.now(),
          deletedAt: null
        };
        await db.docs.add(doc);
      }

      for (const section of indexStructure) {
        const parentFolder = folderMap.get(section.parent);
        if (!parentFolder) continue;
        for (const child of section.children) {
         const subfolder: Folder = {
            id: createId(),
            name: child,
            parentFolderId: parentFolder.id,
            campaignId,
            deletedAt: null
          };
          await db.folders.add(subfolder);

          const doc: Doc = {
            id: createId(),
            folderId: subfolder.id,
            title: child,
            body: "",
            updatedAt: Date.now(),
            campaignId,
            sortIndex: Date.now(),
            deletedAt: null
          };
          await db.docs.add(doc);
        }
      }
    });

    const allDocs = await db.docs.where("campaignId").equals(campaignId).toArray();
    for (const doc of allDocs) {
      await saveDocContent(doc.id, doc.body);
    }

    await updateAllFolderIndexes(campaignId);
  })();

  seedPromises.set(campaignId, promise);
  return promise;
}

export async function migrateImplicitWorld(campaignId: string) {
  const worldFolder = await db.folders
    .where("campaignId")
    .equals(campaignId)
    .filter((folder) => folder.name.toLowerCase() === "world")
    .first();
  if (!worldFolder) return;

  const subfolders = await db.folders.where("parentFolderId").equals(worldFolder.id).toArray();
  const worldDocs = await db.docs.where("folderId").equals(worldFolder.id).toArray();

  await db.transaction("rw", db.folders, db.docs, async () => {
    for (const folder of subfolders) {
      await db.folders.update(folder.id, { parentFolderId: null });
    }
    for (const doc of worldDocs) {
      await db.docs.update(doc.id, { folderId: null });
    }
    await db.folders.delete(worldFolder.id);
  });
}

export async function migrateIndexDocsToSubfolders(campaignId: string) {
  const key = `structureMigrated:${campaignId}`;
  const migrated = await db.settings.get(key);
  if (migrated?.value === "true") return;

  await db.transaction("rw", db.settings, db.folders, db.docs, async () => {
    const topFolders = await db.folders
      .where("campaignId")
      .equals(campaignId)
      .and((folder) => folder.parentFolderId === null)
      .toArray();
    const folderByName = new Map(topFolders.map((folder) => [folder.name, folder]));

    for (const section of indexStructure) {
      const parent = folderByName.get(section.parent);
      if (!parent) continue;
      for (const child of section.children) {
        let subfolder = await db.folders
          .where("campaignId")
          .equals(campaignId)
          .and(
            (folder) => folder.name === child && folder.parentFolderId === parent.id
          )
          .first();
        if (!subfolder) {
          subfolder = {
            id: createId(),
            name: child,
            parentFolderId: parent.id,
            campaignId
          };
          await db.folders.add(subfolder);
        }

        const existingDoc = await db.docs
          .where("campaignId")
          .equals(campaignId)
          .and(
            (doc) =>
              doc.title === child &&
              (doc.folderId === parent.id || doc.folderId === null)
          )
          .first();
        if (existingDoc) {
          await db.docs.update(existingDoc.id, { folderId: subfolder.id });
        }
      }
    }

    await db.settings.put({ key, value: "true" });
  });

  await updateAllFolderIndexes(campaignId);
}

export async function removeDocsMatchingSubfolders(campaignId: string) {
  const key = `subfolderDocCleanup:${campaignId}`;
  const cleaned = await db.settings.get(key);
  if (cleaned?.value === "true") return;

  await db.transaction("rw", db.settings, db.folders, db.docs, async () => {
    const folders = await db.folders
      .where("campaignId")
      .equals(campaignId)
      .and((folder) => folder.parentFolderId !== null)
      .toArray();
    const folderNameSet = new Set(folders.map((folder) => folder.name));

    const docs = await db.docs.where("campaignId").equals(campaignId).toArray();
    for (const doc of docs) {
      if (!folderNameSet.has(doc.title)) continue;
      if (doc.folderId && folders.some((folder) => folder.id === doc.folderId)) {
        await db.docs.delete(doc.id);
      }
    }

    await db.settings.put({ key, value: "true" });
  });
}
