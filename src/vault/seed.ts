import { createId } from "../lib/id";
import { supabase } from "../lib/supabase";
import {
  createFolder,
  getSetting,
  listDocs,
  listFolders,
  moveDoc,
  saveDocContent,
  setSetting,
  updateAllFolderIndexes
} from "./queries";
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
    const { count, error } = await supabase
      .from("docs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    if (error) {
      console.error("Supabase error in seedCampaignIfNeeded:", error);
      return;
    }
    if ((count ?? 0) > 0) return;

    const folderMap = new Map<string, Folder>();
    const folderNames = Array.from(new Set(topLevelFolders));

    for (const name of folderNames) {
      const folder = await createFolder(name, null, campaignId, false);
      folderMap.set(name, folder);
    }

    for (const entry of seedDocs) {
      const doc: Doc = {
        id: createId(),
        folderId: entry.folder ? folderMap.get(entry.folder)?.id ?? null : null,
        title: entry.title,
        body: entry.body,
        updatedAt: Date.now(),
        campaignId,
        shared: false,
        sortIndex: Date.now(),
        deletedAt: null
      };
      const { error: docError } = await supabase.from("docs").insert({
        id: doc.id,
        folder_id: doc.folderId,
        title: doc.title,
        body: doc.body,
        updated_at: doc.updatedAt,
        campaign_id: doc.campaignId,
        shared: doc.shared,
        sort_index: doc.sortIndex,
        deleted_at: doc.deletedAt
      });
      if (docError) {
        console.error("Supabase error in seedCampaignIfNeeded:doc:", docError);
      }
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
          shared: false,
          deletedAt: null
        };
        const { error: folderError } = await supabase.from("folders").insert({
          id: subfolder.id,
          name: subfolder.name,
          parent_folder_id: subfolder.parentFolderId,
          campaign_id: subfolder.campaignId,
          shared: subfolder.shared,
          deleted_at: subfolder.deletedAt
        });
        if (folderError) {
          console.error("Supabase error in seedCampaignIfNeeded:folder:", folderError);
        }

        const doc: Doc = {
          id: createId(),
          folderId: subfolder.id,
          title: child,
          body: "",
          updatedAt: Date.now(),
          campaignId,
          shared: false,
          sortIndex: Date.now(),
          deletedAt: null
        };
        const { error: childDocError } = await supabase.from("docs").insert({
          id: doc.id,
          folder_id: doc.folderId,
          title: doc.title,
          body: doc.body,
          updated_at: doc.updatedAt,
          campaign_id: doc.campaignId,
          shared: doc.shared,
          sort_index: doc.sortIndex,
          deleted_at: doc.deletedAt
        });
        if (childDocError) {
          console.error("Supabase error in seedCampaignIfNeeded:childDoc:", childDocError);
        }
      }
    }

    const allDocs = await listDocs(campaignId);
    for (const doc of allDocs) {
      await saveDocContent(doc.id, doc.body);
    }

    await updateAllFolderIndexes(campaignId);
  })();

  seedPromises.set(campaignId, promise);
  return promise;
}

export async function migrateImplicitWorld(campaignId: string) {
  const folders = await listFolders(campaignId);
  const worldFolder = folders.find((folder) => folder.name.toLowerCase() === "world");
  if (!worldFolder) return;

  const subfolders = folders.filter((folder) => folder.parentFolderId === worldFolder.id);
  const worldDocs = (await listDocs(campaignId)).filter(
    (doc) => doc.folderId === worldFolder.id
  );

  for (const folder of subfolders) {
    await supabase
      .from("folders")
      .update({ parent_folder_id: null })
      .eq("id", folder.id);
  }
  for (const doc of worldDocs) {
    await moveDoc(doc.id, null);
  }
  await supabase.from("folders").delete().eq("id", worldFolder.id);
}

export async function migrateIndexDocsToSubfolders(campaignId: string) {
  const key = `structureMigrated:${campaignId}`;
  const migrated = await getSetting(key);
  if (migrated === "true") return;

  const folders = await listFolders(campaignId);
  const docs = await listDocs(campaignId);
  const topFolders = folders.filter((folder) => folder.parentFolderId === null);
  const folderByName = new Map(topFolders.map((folder) => [folder.name, folder]));

  for (const section of indexStructure) {
    const parent = folderByName.get(section.parent);
    if (!parent) continue;
    for (const child of section.children) {
      let subfolder = folders.find(
        (folder) => folder.name === child && folder.parentFolderId === parent.id
      );
      if (!subfolder) {
        subfolder = await createFolder(child, parent.id, campaignId, false);
      }

      const existingDoc = docs.find(
        (doc) =>
          doc.title === child && (doc.folderId === parent.id || doc.folderId === null)
      );
      if (existingDoc) {
        await moveDoc(existingDoc.id, subfolder.id);
      }
    }
  }

  await setSetting(key, "true");

  await updateAllFolderIndexes(campaignId);
}

export async function removeDocsMatchingSubfolders(campaignId: string) {
  const key = `subfolderDocCleanup:${campaignId}`;
  const cleaned = await getSetting(key);
  if (cleaned === "true") return;

  const folders = await listFolders(campaignId);
  const folderNameSet = new Set(
    folders.filter((folder) => folder.parentFolderId !== null).map((folder) => folder.name)
  );

  const docs = await listDocs(campaignId);
  for (const doc of docs) {
    if (!folderNameSet.has(doc.title)) continue;
    if (doc.folderId && folders.some((folder) => folder.id === doc.folderId)) {
      await supabase.from("docs").delete().eq("id", doc.id);
    }
  }

  await setSetting(key, "true");
}
