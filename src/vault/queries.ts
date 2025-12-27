import { supabase } from "../lib/supabase";
import type {
  Campaign,
  CampaignInvite,
  CampaignMember,
  Doc,
  Edge,
  Folder,
  MapLocation,
  NpcProfile,
  DmScreenCard,
  ReferenceEntry,
  SharedSnippet,
  SessionNotes,
  Tag,
  WorldMap
} from "./types";
import { createId } from "../lib/id";
import { parseLinks, parseTags } from "./parser";
import { INDEX_END, INDEX_START, isIndexDoc } from "./indexing";

const logSupabaseError = (context: string, error: unknown) => {
  if (error) {
    console.error(`Supabase error in ${context}:`, error);
  }
};

const mapCampaign = (row: any): Campaign => ({
  id: row.id,
  name: row.name,
  synopsis: row.synopsis ?? "",
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  archivedAt: row.archived_at ?? null,
  ownerId: row.owner_id ?? undefined
});

const mapFolder = (row: any): Folder => ({
  id: row.id,
  name: row.name,
  parentFolderId: row.parent_folder_id ?? null,
  campaignId: row.campaign_id,
  shared: Boolean(row.shared ?? false),
  deletedAt: row.deleted_at ?? null
});

const mapDoc = (row: any): Doc => ({
  id: row.id,
  folderId: row.folder_id ?? null,
  title: row.title,
  body: row.body ?? "",
  updatedAt: Number(row.updated_at),
  campaignId: row.campaign_id,
  shared: Boolean(row.shared ?? false),
  sortIndex: row.sort_index ?? undefined,
  deletedAt: row.deleted_at ?? null
});

const mapEdge = (row: any): Edge => ({
  id: row.id,
  campaignId: row.campaign_id,
  fromDocId: row.from_doc_id,
  toDocId: row.to_doc_id,
  linkText: row.link_text ?? "",
  edgeType: row.edge_type ?? "link",
  weight: Number(row.weight ?? 1)
});

const mapTag = (row: any): Tag => ({
  id: row.id,
  docId: row.doc_id,
  type: row.type,
  value: row.value
});

const mapReference = (row: any): ReferenceEntry => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  source: row.source,
  content: row.content,
  rawJson: row.raw_json ?? undefined
});

const mapNpcProfile = (row: any): NpcProfile => ({
  docId: row.doc_id,
  creatureId: row.creature_id ?? null,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at)
});

const mapDmScreenCard = (row: any): DmScreenCard => ({
  id: row.id,
  campaignId: row.campaign_id,
  kind: row.kind,
  entryId: row.entry_id,
  column: row.column,
  position: row.position,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at)
});

const mapWorldMap = (row: any): WorldMap => ({
  id: row.id,
  campaignId: row.campaign_id,
  name: row.name,
  imageDataUrl: row.image_data_url,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at)
});

const mapMapLocation = (row: any): MapLocation => ({
  id: row.id,
  mapId: row.map_id,
  docId: row.doc_id,
  x: Number(row.x),
  y: Number(row.y),
  createdAt: Number(row.created_at)
});

const mapSessionNotes = (row: any): SessionNotes => ({
  roomId: row.room_id,
  roomName: row.room_name,
  campaignId: row.campaign_id ?? null,
  content: row.content ?? "",
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at)
});

const mapCampaignMember = (row: any): CampaignMember => ({
  id: row.id ?? undefined,
  campaignId: row.campaign_id,
  userId: row.user_id,
  role: row.role,
  email: row.email ?? null,
  createdAt: Number(row.created_at)
});

const mapCampaignInvite = (row: any): CampaignInvite => ({
  id: row.id,
  campaignId: row.campaign_id,
  email: row.email,
  role: row.role,
  invitedBy: row.invited_by,
  createdAt: Number(row.created_at),
  acceptedAt: row.accepted_at ?? null
});

const mapSharedSnippet = (row: any): SharedSnippet => ({
  id: row.id ?? undefined,
  campaignId: row.campaign_id,
  docId: row.doc_id,
  createdBy: row.created_by,
  snippetText: row.snippet_text,
  startOffset: row.start_offset ?? null,
  endOffset: row.end_offset ?? null,
  createdAt: Number(row.created_at)
});

export async function listFolders(campaignId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);
  logSupabaseError("listFolders", error);
  return (data ?? []).map(mapFolder);
}

export async function listDocs(campaignId: string) {
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);
  logSupabaseError("listDocs", error);
  return (data ?? []).map(mapDoc);
}

export async function getDocById(docId: string) {
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("id", docId)
    .maybeSingle();
  logSupabaseError("getDocById", error);
  return data ? mapDoc(data) : null;
}

export async function getDocByTitle(title: string, campaignId: string) {
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("campaign_id", campaignId)
    .ilike("title", title)
    .is("deleted_at", null)
    .maybeSingle();
  logSupabaseError("getDocByTitle", error);
  return data ? mapDoc(data) : null;
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
    shared: false,
    deletedAt: null
  };
  const { error } = await supabase.from("folders").insert({
    id: folder.id,
    name: folder.name,
    parent_folder_id: folder.parentFolderId,
    campaign_id: folder.campaignId,
    shared: folder.shared,
    deleted_at: folder.deletedAt
  });
  logSupabaseError("createFolder", error);
  if (createIndexDoc) {
    await ensureIndexDoc(folder, campaignId);
  }
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const folder = await getFolderById(folderId);
  if (!folder) return;
  const { error } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", folderId);
  logSupabaseError("renameFolder", error);
  const nextTitle = `${name} Index`;
  const indexDoc = await ensureIndexDoc({ ...folder, name }, folder.campaignId);
  if (indexDoc) {
    const nextBody = buildIndexBody(indexDoc.body, name, []);
    await updateDocById(indexDoc.id, {
      title: nextTitle,
      body: nextBody
    });
  }
}

async function collectFolderTreeIds(folderId: string) {
  const children = await listFoldersByParent(folderId);
  const childIds = await Promise.all(
    children.map((child) => collectFolderTreeIds(child.id))
  );
  return [folderId, ...childIds.flat()];
}

export async function trashFolder(folderId: string) {
  const now = Date.now();
  const folderIds = await collectFolderTreeIds(folderId);
  if (folderIds.length === 0) return;
  const { error: folderError } = await supabase
    .from("folders")
    .update({ deleted_at: now })
    .in("id", folderIds);
  logSupabaseError("trashFolder:folders", folderError);
  const { error: docsError } = await supabase
    .from("docs")
    .update({ deleted_at: now })
    .in("folder_id", folderIds);
  logSupabaseError("trashFolder:docs", docsError);
}

export async function restoreFolder(folderId: string) {
  const folderIds = await collectFolderTreeIds(folderId);
  const folders = await listFoldersByIds(folderIds);
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    const parent = folder.parentFolderId ? folderMap.get(folder.parentFolderId) : null;
    const nextParentId = parent && !parent.deletedAt ? folder.parentFolderId : null;
    await updateFolderById(folder.id, {
      deletedAt: null,
      parentFolderId: nextParentId
    });
  }
  if (folderIds.length > 0) {
    const { error } = await supabase
      .from("docs")
      .update({ deleted_at: null })
      .in("folder_id", folderIds);
    logSupabaseError("restoreFolder:docs", error);
  }
}

export async function purgeFolder(folderId: string) {
  const folderIds = await collectFolderTreeIds(folderId);
  const docs = await listDocsByFolderIds(folderIds);
  const docIds = docs.map((doc) => doc.id);
  if (docIds.length > 0) {
    await deleteEdgesForDocs(docIds);
    await deleteTagsForDocs(docIds);
    await deleteNpcProfilesForDocs(docIds);
    await deleteMapLocationsForDocs(docIds);
    const { error } = await supabase.from("docs").delete().in("id", docIds);
    logSupabaseError("purgeFolder:docs", error);
  }
  if (folderIds.length > 0) {
    const { error } = await supabase.from("folders").delete().in("id", folderIds);
    logSupabaseError("purgeFolder:folders", error);
  }
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
    shared: false,
    sortIndex,
    deletedAt: null
  };
  const { error } = await supabase.from("docs").insert({
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
  logSupabaseError("createDoc", error);
  return doc;
}

export async function renameDoc(docId: string, title: string) {
  const { error } = await supabase
    .from("docs")
    .update({ title: title || "Untitled Page" })
    .eq("id", docId);
  logSupabaseError("renameDoc", error);
}

export async function setDocShared(docId: string, shared: boolean) {
  const { error } = await supabase.from("docs").update({ shared }).eq("id", docId);
  logSupabaseError("setDocShared", error);
}

export async function setFolderShared(folderId: string, shared: boolean) {
  const { error } = await supabase
    .from("folders")
    .update({ shared })
    .eq("id", folderId);
  logSupabaseError("setFolderShared", error);
}

export async function moveDoc(
  docId: string,
  folderId: string | null,
  sortIndex?: number
) {
  const doc = await getDocById(docId);
  if (!doc) return;
  const nextSort =
    typeof sortIndex === "number"
      ? sortIndex
      : await getNextDocSortIndex(folderId, doc.campaignId);
  const { error } = await supabase
    .from("docs")
    .update({ folder_id: folderId, sort_index: nextSort })
    .eq("id", docId);
  logSupabaseError("moveDoc", error);
}

export async function setDocSortOrder(
  folderId: string | null,
  campaignId: string,
  orderedDocIds: string[]
) {
  const updates = orderedDocIds.map((id, index) =>
    supabase
      .from("docs")
      .update({ sort_index: index + 1, folder_id: folderId })
      .eq("id", id)
  );
  await Promise.all(updates);
}

export async function trashDoc(docId: string) {
  const now = Date.now();
  const { error } = await supabase
    .from("docs")
    .update({ deleted_at: now })
    .eq("id", docId);
  logSupabaseError("trashDoc", error);
}

export async function restoreDoc(docId: string) {
  const doc = await getDocById(docId);
  if (!doc) return;
  let nextFolderId = doc.folderId;
  if (nextFolderId) {
    const folder = await getFolderById(nextFolderId);
    if (!folder || folder.deletedAt) {
      nextFolderId = null;
    }
  }
  const nextSortIndex = await getNextDocSortIndex(nextFolderId, doc.campaignId);
  const { error } = await supabase
    .from("docs")
    .update({
      deleted_at: null,
      folder_id: nextFolderId,
      sort_index: nextSortIndex
    })
    .eq("id", docId);
  logSupabaseError("restoreDoc", error);
}

export async function purgeDoc(docId: string) {
  await deleteEdgesForDocs([docId]);
  await deleteTagsForDocs([docId]);
  await deleteNpcProfilesForDocs([docId]);
  await deleteMapLocationsForDocs([docId]);
  const { error } = await supabase.from("docs").delete().eq("id", docId);
  logSupabaseError("purgeDoc", error);
}

export async function saveDocContent(docId: string, body: string) {
  const doc = await getDocById(docId);
  if (!doc) return;
  const updatedAt = Date.now();
  const { error } = await supabase
    .from("docs")
    .update({ body, updated_at: updatedAt })
    .eq("id", docId);
  logSupabaseError("saveDocContent:update", error);

  const parsedLinks = parseLinks(body);
  const parsedTags = parseTags(body);

  const uniqueLinks = new Map<string, { linkText: string; docId?: string }>();
  parsedLinks.forEach((link) => {
    uniqueLinks.set(link.targetTitle, { linkText: link.linkText, docId: link.docId });
  });

  await deleteEdgesForDocs([docId], "from");

  for (const [targetTitle, payload] of uniqueLinks) {
    const linkText = payload.linkText;
    if (payload.docId) {
      const target = await getDocById(payload.docId);
      if (!target) continue;
      await insertEdge(doc.campaignId, docId, target.id, linkText);
      continue;
    }
    let target = await getDocByTitle(targetTitle, doc.campaignId);
    if (!target) {
      target = await createDoc(targetTitle, null, doc.campaignId);
    }
    await insertEdge(doc.campaignId, docId, target.id, linkText);
  }

  await deleteTagsForDocs([docId]);
  if (parsedTags.length > 0) {
    const tags: Tag[] = parsedTags.map((tag) => ({
      docId,
      type: tag.type,
      value: tag.value
    }));
    const { error: tagError } = await supabase.from("tags").insert(
      tags.map((tag) => ({
        doc_id: tag.docId,
        type: tag.type,
        value: tag.value
      }))
    );
    logSupabaseError("saveDocContent:tags", tagError);
  }
}

export async function listBacklinks(docId: string) {
  const { data: edgeRows, error } = await supabase
    .from("edges")
    .select("*")
    .eq("to_doc_id", docId);
  logSupabaseError("listBacklinks:edges", error);
  const edges = (edgeRows ?? []).map(mapEdge);
  const sourceDocs = await listDocsByIds(edges.map((edge) => edge.fromDocId));
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

export async function listEdgesFromDoc(docId: string) {
  const { data, error } = await supabase
    .from("edges")
    .select("*")
    .eq("from_doc_id", docId);
  logSupabaseError("listEdgesFromDoc", error);
  return (data ?? []).map(mapEdge);
}

export async function listEdgesToDoc(docId: string) {
  const { data, error } = await supabase
    .from("edges")
    .select("*")
    .eq("to_doc_id", docId);
  logSupabaseError("listEdgesToDoc", error);
  return (data ?? []).map(mapEdge);
}

export async function listEdgesFromDocs(docIds: string[]) {
  if (docIds.length === 0) return [];
  const { data, error } = await supabase
    .from("edges")
    .select("*")
    .in("from_doc_id", docIds);
  logSupabaseError("listEdgesFromDocs", error);
  return (data ?? []).map(mapEdge);
}

export async function listEdgesToDocs(docIds: string[]) {
  if (docIds.length === 0) return [];
  const { data, error } = await supabase
    .from("edges")
    .select("*")
    .in("to_doc_id", docIds);
  logSupabaseError("listEdgesToDocs", error);
  return (data ?? []).map(mapEdge);
}

export type GraphHop = {
  docId: string;
  hop: number;
  path: string[];
};

export async function graphKHopDocs(
  campaignId: string,
  startDocId: string,
  maxHops: number,
  direction: "in" | "out" | "both" = "both"
) {
  const { data, error } = await supabase.rpc("graph_k_hop_docs", {
    p_campaign_id: campaignId,
    p_start_doc_id: startDocId,
    p_max_hops: maxHops,
    p_direction: direction
  });
  logSupabaseError("graphKHopDocs", error);
  return (data ?? []).map((row: any) => ({
    docId: row.doc_id,
    hop: Number(row.hop),
    path: Array.isArray(row.path) ? row.path : []
  })) as GraphHop[];
}

export async function graphShortestPath(
  campaignId: string,
  startDocId: string,
  targetDocId: string,
  maxHops = 6,
  direction: "in" | "out" | "both" = "both"
) {
  const { data, error } = await supabase.rpc("graph_shortest_path", {
    p_campaign_id: campaignId,
    p_start_doc_id: startDocId,
    p_target_doc_id: targetDocId,
    p_max_hops: maxHops,
    p_direction: direction
  });
  logSupabaseError("graphShortestPath", error);
  if (!Array.isArray(data)) return null;
  return data as string[];
}

export async function listTagsForDoc(docId: string) {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("doc_id", docId);
  logSupabaseError("listTagsForDoc", error);
  return (data ?? []).map(mapTag);
}

export async function listTagsForDocs(docIds: string[]) {
  if (docIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .in("doc_id", docIds);
  logSupabaseError("listTagsForDocs", error);
  return (data ?? []).map(mapTag);
}

export async function listDocsWithTag(type: string, value: string, campaignId: string) {
  const { data: tags, error } = await supabase
    .from("tags")
    .select("doc_id")
    .eq("type", type)
    .eq("value", value);
  logSupabaseError("listDocsWithTag:tags", error);
  const docIds = (tags ?? []).map((tag) => tag.doc_id);
  if (docIds.length === 0) return [];
  const { data, error: docError } = await supabase
    .from("docs")
    .select("*")
    .in("id", docIds)
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);
  logSupabaseError("listDocsWithTag:docs", docError);
  return (data ?? []).map(mapDoc);
}

export async function searchDocsByTitle(query: string, campaignId: string) {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("campaign_id", campaignId)
    .ilike("title", `%${lower}%`)
    .is("deleted_at", null);
  logSupabaseError("searchDocsByTitle", error);
  return (data ?? []).map(mapDoc);
}

export async function getSetting(key: string) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  logSupabaseError("getSetting", error);
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "owner_id,key" });
  logSupabaseError("setSetting", error);
}

export async function getSessionNotes(roomId: string) {
  const { data, error } = await supabase
    .from("session_notes")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  logSupabaseError("getSessionNotes", error);
  return data ? mapSessionNotes(data) : null;
}

export async function saveSessionNotes(
  roomId: string,
  updates: Omit<SessionNotes, "roomId" | "createdAt"> & {
    createdAt?: number;
  }
) {
  const now = Date.now();
  const next: SessionNotes = {
    roomId,
    roomName: updates.roomName,
    campaignId: updates.campaignId ?? null,
    content: updates.content,
    createdAt: updates.createdAt ?? now,
    updatedAt: now
  };
  const { error } = await supabase.from("session_notes").upsert(
    {
      room_id: next.roomId,
      room_name: next.roomName,
      campaign_id: next.campaignId,
      content: next.content,
      created_at: next.createdAt,
      updated_at: next.updatedAt
    },
    { onConflict: "room_id" }
  );
  logSupabaseError("saveSessionNotes", error);
}

export async function listCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  logSupabaseError("listCampaigns", error);
  return (data ?? []).map(mapCampaign);
}

export async function listArchivedCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .not("archived_at", "is", null)
    .order("updated_at", { ascending: false });
  logSupabaseError("listArchivedCampaigns", error);
  return (data ?? []).map(mapCampaign);
}

export async function getCampaignById(id: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  logSupabaseError("getCampaignById", error);
  return data ? mapCampaign(data) : null;
}

export async function createCampaign(name: string, synopsis = "") {
  const now = Date.now();
  const campaign: Campaign = {
    id: createId(),
    name: name || "Untitled Campaign",
    synopsis,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
  const { error } = await supabase.from("campaigns").insert({
    id: campaign.id,
    name: campaign.name,
    synopsis: campaign.synopsis,
    created_at: campaign.createdAt,
    updated_at: campaign.updatedAt,
    archived_at: campaign.archivedAt
  });
  logSupabaseError("createCampaign", error);
  return campaign;
}

export async function updateCampaign(campaignId: string, updates: Partial<Campaign>) {
  const { error } = await supabase
    .from("campaigns")
    .update({
      name: updates.name,
      synopsis: updates.synopsis,
      updated_at: Date.now(),
      archived_at: updates.archivedAt
    })
    .eq("id", campaignId);
  logSupabaseError("updateCampaign", error);
}

export async function archiveCampaign(campaignId: string) {
  console.debug("[WB] archiveCampaign request", { campaignId });
  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: Date.now(), updated_at: Date.now() })
    .eq("id", campaignId);
  logSupabaseError("archiveCampaign", error);
  console.debug("[WB] archiveCampaign response", { error });
  return error ?? null;
}

export async function unarchiveCampaign(campaignId: string) {
  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: null, updated_at: Date.now() })
    .eq("id", campaignId);
  logSupabaseError("unarchiveCampaign", error);
  return error ?? null;
}

export async function deleteCampaign(campaignId: string) {
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  logSupabaseError("deleteCampaign", error);
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
  const existing = await listDocsByFolder(folder.id, campaignId);
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
    shared: false,
    sortIndex: await getNextDocSortIndex(folder.id, campaignId),
    deletedAt: null
  };
  const { error } = await supabase.from("docs").insert({
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
  logSupabaseError("ensureIndexDoc", error);
  return doc;
}

export async function updateAllFolderIndexes(campaignId: string) {
  const folders = await listFolders(campaignId);
  const docs = await listDocs(campaignId);

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
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("campaign_id", campaignId)
    .not("deleted_at", "is", null);
  logSupabaseError("listTrashedDocs", error);
  return (data ?? []).map(mapDoc);
}

export async function listTrashedFolders(campaignId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("campaign_id", campaignId)
    .not("deleted_at", "is", null);
  logSupabaseError("listTrashedFolders", error);
  return (data ?? []).map(mapFolder);
}

async function getNextDocSortIndex(folderId: string | null, campaignId: string) {
  const query = supabase
    .from("docs")
    .select("sort_index")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("sort_index", { ascending: false })
    .limit(1);
  if (folderId) {
    query.eq("folder_id", folderId);
  } else {
    query.is("folder_id", null);
  }
  const { data, error } = await query;
  logSupabaseError("getNextDocSortIndex", error);
  const max = data?.[0]?.sort_index ?? 0;
  return Number(max) + 1;
}

export async function listReferencesBySlug(slug: string) {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("slug", slug)
    .order("name", { ascending: true });
  logSupabaseError("listReferencesBySlug", error);
  return (data ?? []).map(mapReference);
}

export async function listAllReferences() {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .order("name", { ascending: true });
  logSupabaseError("listAllReferences", error);
  return (data ?? []).map(mapReference);
}

export async function listCampaignMembers(campaignId: string) {
  const { data, error } = await supabase
    .from("campaign_members")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  logSupabaseError("listCampaignMembers", error);
  return (data ?? []).map(mapCampaignMember);
}

export async function listCampaignInvites(campaignId: string) {
  const { data, error } = await supabase
    .from("campaign_invites")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  logSupabaseError("listCampaignInvites", error);
  return (data ?? []).map(mapCampaignInvite);
}

export async function createCampaignInvite(
  campaignId: string,
  email: string,
  role: "dm" | "player",
  invitedBy: string
) {
  const invite: CampaignInvite = {
    id: createId(),
    campaignId,
    email,
    role,
    invitedBy,
    createdAt: Date.now(),
    acceptedAt: null
  };
  const { error } = await supabase.from("campaign_invites").insert({
    id: invite.id,
    campaign_id: invite.campaignId,
    email: invite.email,
    role: invite.role,
    invited_by: invite.invitedBy,
    created_at: invite.createdAt,
    accepted_at: invite.acceptedAt
  });
  logSupabaseError("createCampaignInvite", error);
  return invite;
}

export async function deleteCampaignInvite(inviteId: string) {
  const { error } = await supabase.from("campaign_invites").delete().eq("id", inviteId);
  logSupabaseError("deleteCampaignInvite", error);
}

export async function acceptCampaignInvite(inviteId: string, userId: string, email: string) {
  const { data, error } = await supabase
    .from("campaign_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();
  logSupabaseError("acceptCampaignInvite:load", error);
  if (!data) return null;
  if (data.accepted_at) return mapCampaignInvite(data);
  if (data.email?.toLowerCase() !== email.toLowerCase()) return null;

  const now = Date.now();
  const { error: memberError } = await supabase.from("campaign_members").insert({
    campaign_id: data.campaign_id,
    user_id: userId,
    role: data.role,
    email,
    created_at: now
  });
  logSupabaseError("acceptCampaignInvite:member", memberError);

  const { error: acceptError } = await supabase
    .from("campaign_invites")
    .update({ accepted_at: now })
    .eq("id", inviteId);
  logSupabaseError("acceptCampaignInvite:update", acceptError);

  return mapCampaignInvite({ ...data, accepted_at: now });
}

export async function listSharedSnippets(campaignId: string) {
  const { data, error } = await supabase
    .from("shared_snippets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  logSupabaseError("listSharedSnippets", error);
  return (data ?? []).map(mapSharedSnippet);
}

export async function createSharedSnippet(
  campaignId: string,
  docId: string,
  snippetText: string,
  createdBy: string,
  startOffset?: number | null,
  endOffset?: number | null
) {
  const now = Date.now();
  const { error } = await supabase.from("shared_snippets").insert({
    campaign_id: campaignId,
    doc_id: docId,
    created_by: createdBy,
    snippet_text: snippetText,
    start_offset: startOffset ?? null,
    end_offset: endOffset ?? null,
    created_at: now
  });
  logSupabaseError("createSharedSnippet", error);
}

export async function deleteSharedSnippet(snippetId: number) {
  const { error } = await supabase
    .from("shared_snippets")
    .delete()
    .eq("id", snippetId);
  logSupabaseError("deleteSharedSnippet", error);
}

export async function listReferencesBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .in("slug", slugs)
    .order("name", { ascending: true });
  logSupabaseError("listReferencesBySlugs", error);
  return (data ?? []).map(mapReference);
}

export async function getReferenceById(id: string) {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  logSupabaseError("getReferenceById", error);
  return data ? mapReference(data) : null;
}

export async function searchReferences(slug: string, query: string) {
  const lower = query.toLowerCase();
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("slug", slug)
    .ilike("name", `%${lower}%`)
    .order("name", { ascending: true });
  logSupabaseError("searchReferences", error);
  return (data ?? []).map(mapReference);
}

export async function getNpcProfile(docId: string) {
  const { data, error } = await supabase
    .from("npc_profiles")
    .select("*")
    .eq("doc_id", docId)
    .maybeSingle();
  logSupabaseError("getNpcProfile", error);
  return data ? mapNpcProfile(data) : null;
}

export async function setNpcProfile(docId: string, creatureId: string | null) {
  const profile: NpcProfile = {
    docId,
    creatureId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const { error } = await supabase.from("npc_profiles").upsert(
    {
      doc_id: profile.docId,
      creature_id: profile.creatureId,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt
    },
    { onConflict: "doc_id" }
  );
  logSupabaseError("setNpcProfile", error);
}

export async function listDmScreenCards(campaignId: string) {
  const { data, error } = await supabase
    .from("dm_screen_cards")
    .select("*")
    .eq("campaign_id", campaignId);
  logSupabaseError("listDmScreenCards", error);
  return (data ?? []).map(mapDmScreenCard);
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
  const { data, error } = await supabase
    .from("dm_screen_cards")
    .insert({
      campaign_id: card.campaignId,
      kind: card.kind,
      entry_id: card.entryId,
      column: card.column,
      position: card.position,
      created_at: card.createdAt,
      updated_at: card.updatedAt
    })
    .select("id")
    .maybeSingle();
  logSupabaseError("createDmScreenCard", error);
  return data?.id ?? null;
}

export async function updateDmScreenCard(
  cardId: number,
  updates: Partial<Omit<DmScreenCard, "id" | "campaignId">>
) {
  const { error } = await supabase
    .from("dm_screen_cards")
    .update({
      kind: updates.kind,
      entry_id: updates.entryId,
      column: updates.column,
      position: updates.position,
      updated_at: Date.now()
    })
    .eq("id", cardId);
  logSupabaseError("updateDmScreenCard", error);
}

export async function deleteDmScreenCard(cardId: number) {
  const { error } = await supabase.from("dm_screen_cards").delete().eq("id", cardId);
  logSupabaseError("deleteDmScreenCard", error);
}

export async function listMaps(campaignId: string) {
  const { data, error } = await supabase
    .from("maps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("updated_at", { ascending: true });
  logSupabaseError("listMaps", error);
  return (data ?? []).map(mapWorldMap);
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
  const { error } = await supabase.from("maps").insert({
    id: map.id,
    campaign_id: map.campaignId,
    name: map.name,
    image_data_url: map.imageDataUrl,
    created_at: map.createdAt,
    updated_at: map.updatedAt
  });
  logSupabaseError("createMap", error);
  return map;
}

export async function updateMap(mapId: string, updates: Partial<WorldMap>) {
  const { error } = await supabase
    .from("maps")
    .update({
      name: updates.name,
      image_data_url: updates.imageDataUrl,
      updated_at: Date.now()
    })
    .eq("id", mapId);
  logSupabaseError("updateMap", error);
}

export async function deleteMap(mapId: string) {
  const { error: locationError } = await supabase
    .from("map_locations")
    .delete()
    .eq("map_id", mapId);
  logSupabaseError("deleteMap:locations", locationError);
  const { error } = await supabase.from("maps").delete().eq("id", mapId);
  logSupabaseError("deleteMap", error);
}

export async function listMapLocations(mapId: string) {
  const { data, error } = await supabase
    .from("map_locations")
    .select("*")
    .eq("map_id", mapId);
  logSupabaseError("listMapLocations", error);
  return (data ?? []).map(mapMapLocation);
}

export async function listMapLocationsByDoc(docId: string) {
  const { data, error } = await supabase
    .from("map_locations")
    .select("*")
    .eq("doc_id", docId);
  logSupabaseError("listMapLocationsByDoc", error);
  return (data ?? []).map(mapMapLocation);
}

export async function createMapLocation(mapId: string, docId: string, x: number, y: number) {
  const location: MapLocation = {
    mapId,
    docId,
    x,
    y,
    createdAt: Date.now()
  };
  const { error } = await supabase.from("map_locations").insert({
    map_id: location.mapId,
    doc_id: location.docId,
    x: location.x,
    y: location.y,
    created_at: location.createdAt
  });
  logSupabaseError("createMapLocation", error);
  return location;
}

export async function deleteMapLocation(id: number) {
  const { error } = await supabase.from("map_locations").delete().eq("id", id);
  logSupabaseError("deleteMapLocation", error);
}

async function getFolderById(folderId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("id", folderId)
    .maybeSingle();
  logSupabaseError("getFolderById", error);
  return data ? mapFolder(data) : null;
}

async function updateFolderById(
  folderId: string,
  updates: Partial<Pick<Folder, "name" | "parentFolderId" | "deletedAt">>
) {
  const { error } = await supabase
    .from("folders")
    .update({
      name: updates.name,
      parent_folder_id: updates.parentFolderId,
      deleted_at: updates.deletedAt ?? null
    })
    .eq("id", folderId);
  logSupabaseError("updateFolderById", error);
}

async function updateDocById(
  docId: string,
  updates: Partial<Pick<Doc, "title" | "body" | "updatedAt" | "folderId" | "sortIndex">>
) {
  const { error } = await supabase
    .from("docs")
    .update({
      title: updates.title,
      body: updates.body,
      updated_at: updates.updatedAt,
      folder_id: updates.folderId,
      sort_index: updates.sortIndex
    })
    .eq("id", docId);
  logSupabaseError("updateDocById", error);
}

async function listFoldersByParent(parentFolderId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("parent_folder_id", parentFolderId);
  logSupabaseError("listFoldersByParent", error);
  return (data ?? []).map(mapFolder);
}

async function listFoldersByIds(folderIds: string[]) {
  if (folderIds.length === 0) return [];
  const { data, error } = await supabase.from("folders").select("*").in("id", folderIds);
  logSupabaseError("listFoldersByIds", error);
  return (data ?? []).map(mapFolder);
}

async function listDocsByFolder(folderId: string, campaignId: string) {
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("folder_id", folderId);
  logSupabaseError("listDocsByFolder", error);
  return (data ?? []).map(mapDoc);
}

async function listDocsByFolderIds(folderIds: string[]) {
  if (folderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .in("folder_id", folderIds);
  logSupabaseError("listDocsByFolderIds", error);
  return (data ?? []).map(mapDoc);
}

export async function listDocsByIds(docIds: string[]) {
  if (docIds.length === 0) return [];
  const { data, error } = await supabase.from("docs").select("*").in("id", docIds);
  logSupabaseError("listDocsByIds", error);
  return (data ?? []).map(mapDoc);
}

async function insertEdge(
  campaignId: string,
  fromDocId: string,
  toDocId: string,
  linkText: string
) {
  const { error } = await supabase.from("edges").insert({
    campaign_id: campaignId,
    from_doc_id: fromDocId,
    to_doc_id: toDocId,
    link_text: linkText,
    edge_type: "link",
    weight: 1
  });
  logSupabaseError("insertEdge", error);
}

async function deleteEdgesForDocs(docIds: string[], direction: "from" | "to" | "both" = "both") {
  if (docIds.length === 0) return;
  if (direction === "from" || direction === "both") {
    const { error } = await supabase.from("edges").delete().in("from_doc_id", docIds);
    logSupabaseError("deleteEdgesForDocs:from", error);
  }
  if (direction === "to" || direction === "both") {
    const { error } = await supabase.from("edges").delete().in("to_doc_id", docIds);
    logSupabaseError("deleteEdgesForDocs:to", error);
  }
}

async function deleteTagsForDocs(docIds: string[]) {
  if (docIds.length === 0) return;
  const { error } = await supabase.from("tags").delete().in("doc_id", docIds);
  logSupabaseError("deleteTagsForDocs", error);
}

async function deleteNpcProfilesForDocs(docIds: string[]) {
  if (docIds.length === 0) return;
  const { error } = await supabase.from("npc_profiles").delete().in("doc_id", docIds);
  logSupabaseError("deleteNpcProfilesForDocs", error);
}

async function deleteMapLocationsForDocs(docIds: string[]) {
  if (docIds.length === 0) return;
  const { error } = await supabase.from("map_locations").delete().in("doc_id", docIds);
  logSupabaseError("deleteMapLocationsForDocs", error);
}
