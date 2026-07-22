export type Folder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  campaignId: string;
  shared: boolean;
  deletedAt?: number | null;
};

export type Doc = {
  id: string;
  folderId: string | null;
  title: string;
  body: string;
  updatedAt: number;
  campaignId: string;
  shared: boolean;
  sortIndex?: number;
  deletedAt?: number | null;
};

export type Edge = {
  id?: number;
  campaignId?: string;
  fromDocId: string;
  toDocId: string;
  linkText: string;
  edgeType?: string;
  weight?: number;
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
  archivedAt?: number | null;
  ownerId?: string;
};

export type CampaignMember = {
  id?: number;
  campaignId: string;
  userId: string;
  role: "dm" | "player";
  email?: string | null;
  createdAt: number;
};

export type CampaignInvite = {
  id: string;
  campaignId: string;
  email: string;
  role: "dm" | "player";
  invitedBy: string;
  createdAt: number;
  acceptedAt?: number | null;
};

export type SharedSnippet = {
  id?: number;
  campaignId: string;
  docId: string;
  createdBy: string;
  snippetText: string;
  startOffset?: number | null;
  endOffset?: number | null;
  createdAt: number;
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
  imageStoragePath?: string | null;
  width?: number | null;
  height?: number | null;
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

export type PageTemplate = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  kind: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  ownerId?: string;
};

export type Asset = {
  id: string;
  campaignId: string;
  docId: string | null;
  storagePath: string;
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  altText?: string | null;
  createdAt: number;
  updatedAt: number;
  ownerId?: string;
};

export type VaultSourceProvider = "zip" | "github";

export type VaultSource = {
  id: string;
  campaignId: string;
  provider: VaultSourceProvider;
  sourceKey: string;
  displayName: string;
  repoOwner?: string | null;
  repoName?: string | null;
  repoBranch?: string | null;
  rootPath?: string | null;
  lastSyncAt?: number | null;
  lastSyncStatus?: string | null;
  lastSyncMessage?: string | null;
  lastCommitSha?: string | null;
  createdAt: number;
  updatedAt: number;
  ownerId?: string;
};

export type VaultSourceFileKind = "doc" | "image";

export type VaultSourceFile = {
  id: string;
  sourceId: string;
  campaignId: string;
  kind: VaultSourceFileKind;
  sourcePath: string;
  docId?: string | null;
  assetId?: string | null;
  contentHash: string;
  importedTitle: string;
  lastSeenAt: number;
  deletedAt?: number | null;
  conflictAt?: number | null;
  conflictReason?: string | null;
};
