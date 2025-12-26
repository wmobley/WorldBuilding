import Dexie, { type Table } from "dexie";
import type {
  Campaign,
  Doc,
  Edge,
  Folder,
  MapLocation,
  NpcProfile,
  DmScreenCard,
  ReferenceEntry,
  Setting,
  Tag,
  WorldMap,
  SessionNotes
} from "./types";
import { createId } from "../lib/id";

export class WorldbuilderDB extends Dexie {
  campaigns!: Table<Campaign, string>;
  folders!: Table<Folder, string>;
  docs!: Table<Doc, string>;
  edges!: Table<Edge, number>;
  tags!: Table<Tag, number>;
  settings!: Table<Setting, string>;
  references!: Table<ReferenceEntry, string>;
  maps!: Table<WorldMap, string>;
  mapLocations!: Table<MapLocation, number>;
  npcProfiles!: Table<NpcProfile, string>;
  dmScreenCards!: Table<DmScreenCard, number>;
  sessionNotes!: Table<SessionNotes, string>;

  constructor() {
    super("worldbuilder");
    this.version(1).stores({
      folders: "id, name, parentFolderId",
      docs: "id, folderId, title, updatedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key"
    });

    this.version(2)
      .stores({
        campaigns: "id, name, updatedAt",
        folders: "id, campaignId, name, parentFolderId",
        docs: "id, campaignId, folderId, title, updatedAt",
        edges: "++id, fromDocId, toDocId",
        tags: "++id, docId, type, value",
        settings: "key"
      })
      .upgrade(async (tx) => {
        const campaignsTable = tx.table("campaigns") as Table<Campaign, string>;
        const foldersTable = tx.table("folders") as Table<Folder, string>;
        const docsTable = tx.table("docs") as Table<Doc, string>;
        const settingsTable = tx.table("settings") as Table<Setting, string>;

        const existingCampaigns = await campaignsTable.toArray();
        let campaignId = existingCampaigns[0]?.id;
        if (!campaignId) {
          const now = Date.now();
          const campaign: Campaign = {
            id: createId(),
            name: "Campaign One",
            synopsis: "",
            createdAt: now,
            updatedAt: now
          };
          campaignId = campaign.id;
          await campaignsTable.add(campaign);
        }

        const folders = await foldersTable.toArray();
        await Promise.all(
          folders.map((folder) =>
            foldersTable.update(folder.id, { campaignId: campaignId! })
          )
        );

        const docs = await docsTable.toArray();
        await Promise.all(
          docs.map((doc) => docsTable.update(doc.id, { campaignId: campaignId! }))
        );

        await settingsTable.put({ key: "activeCampaignId", value: campaignId! });
      });

    this.version(3).stores({
      campaigns: "id, name, updatedAt",
      folders: "id, campaignId, name, parentFolderId",
      docs: "id, campaignId, folderId, title, updatedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key",
      references: "id, slug, name, source"
    });

    this.version(4).stores({
      campaigns: "id, name, updatedAt",
      folders: "id, campaignId, name, parentFolderId",
      docs: "id, campaignId, folderId, title, updatedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key",
      references: "id, slug, name, source",
      maps: "id, campaignId, name, updatedAt",
      mapLocations: "++id, mapId, docId"
    });

    this.version(5).stores({
      campaigns: "id, name, updatedAt",
      folders: "id, campaignId, name, parentFolderId",
      docs: "id, campaignId, folderId, title, updatedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key",
      references: "id, slug, name, source",
      maps: "id, campaignId, name, updatedAt",
      mapLocations: "++id, mapId, docId",
      npcProfiles: "docId"
    });

    this.version(6).stores({
      campaigns: "id, name, updatedAt",
      folders: "id, campaignId, name, parentFolderId",
      docs: "id, campaignId, folderId, title, updatedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key",
      references: "id, slug, name, source",
      maps: "id, campaignId, name, updatedAt",
      mapLocations: "++id, mapId, docId",
      npcProfiles: "docId",
      dmScreenCards: "++id, campaignId, column, position"
    });

    this.version(7)
      .stores({
        campaigns: "id, name, updatedAt",
        folders: "id, campaignId, name, parentFolderId, deletedAt",
        docs: "id, campaignId, folderId, title, updatedAt, sortIndex, deletedAt",
        edges: "++id, fromDocId, toDocId",
        tags: "++id, docId, type, value",
        settings: "key",
        references: "id, slug, name, source",
        maps: "id, campaignId, name, updatedAt",
        mapLocations: "++id, mapId, docId",
        npcProfiles: "docId",
        dmScreenCards: "++id, campaignId, column, position"
      })
      .upgrade(async (tx) => {
        const foldersTable = tx.table("folders") as Table<Folder, string>;
        const docsTable = tx.table("docs") as Table<Doc, string>;

        const folders = await foldersTable.toArray();
        await Promise.all(
          folders.map((folder) =>
            foldersTable.update(folder.id, {
              deletedAt: folder.deletedAt ?? null
            })
          )
        );

        const docs = await docsTable.toArray();
        const now = Date.now();
        await Promise.all(
          docs.map((doc, index) =>
            docsTable.update(doc.id, {
              deletedAt: doc.deletedAt ?? null,
              sortIndex: doc.sortIndex ?? doc.updatedAt ?? now + index
            })
          )
        );
      });

    this.version(8).stores({
      campaigns: "id, name, updatedAt",
      folders: "id, campaignId, name, parentFolderId, deletedAt",
      docs: "id, campaignId, folderId, title, updatedAt, sortIndex, deletedAt",
      edges: "++id, fromDocId, toDocId",
      tags: "++id, docId, type, value",
      settings: "key",
      references: "id, slug, name, source",
      maps: "id, campaignId, name, updatedAt",
      mapLocations: "++id, mapId, docId",
      npcProfiles: "docId",
      dmScreenCards: "++id, campaignId, column, position",
      sessionNotes: "roomId, campaignId, updatedAt"
    });
  }
}

export const db = new WorldbuilderDB();
