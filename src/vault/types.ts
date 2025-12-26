export type Folder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  campaignId: string;
  deletedAt?: number | null;
};

export type Doc = {
  id: string;
  folderId: string | null;
  title: string;
  body: string;
  updatedAt: number;
  campaignId: string;
  sortIndex?: number;
  deletedAt?: number | null;
};

export type Edge = {
  id?: number;
  fromDocId: string;
  toDocId: string;
  linkText: string;
};

export type Tag = {
  id?: number;
  docId: string;
  type: string;
  value: string;
};

export type Setting = {
  key: string;
  value: string;
};

export type Campaign = {
  id: string;
  name: string;
  synopsis: string;
  createdAt: number;
  updatedAt: number;
};

export type ReferenceEntry = {
  id: string;
  slug: string;
  name: string;
  source: string;
  content: string;
  rawJson?: string;
};

export type NpcProfile = {
  docId: string;
  creatureId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DmScreenCard = {
  id?: number;
  campaignId: string;
  kind: "doc" | "reference";
  entryId: string;
  column: number;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type WorldMap = {
  id: string;
  campaignId: string;
  name: string;
  imageDataUrl: string;
  createdAt: number;
  updatedAt: number;
};

export type MapLocation = {
  id?: number;
  mapId: string;
  docId: string;
  x: number;
  y: number;
  createdAt: number;
};

export type SessionNotes = {
  roomId: string;
  roomName: string;
  campaignId: string | null;
  content: string;
  createdAt: number;
  updatedAt: number;
};
