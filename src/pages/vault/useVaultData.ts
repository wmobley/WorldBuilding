import useSupabaseQuery from "../../lib/useSupabaseQuery";
import { extractBacklinkContext } from "../../lib/text";
import type { MapPin } from "../../ui/Marginalia";
import { buildWorldContext } from "../../prep/context";
import { isIndexDoc } from "../../vault/indexing";
import {
  getDocById,
  getNpcProfile,
  getReferenceById,
  listBacklinks,
  listDocs,
  listDocsWithTag,
  listFolders,
  listMapLocationsByDoc,
  listMaps,
  listReferencesBySlug,
  listReferencesBySlugs,
  listTagsForDoc,
  listTagsForDocs,
  listTrashedDocs,
  listTrashedFolders
} from "../../vault/queries";
import type { Doc } from "../../vault/types";

type TagFilter = { type: string; value: string } | null;
type BacklinkEntry = {
  source: Doc;
  heading: string | null;
  subheading: string | null;
  line: string;
};

type UseVaultDataInput = {
  activeCampaignId: string | null;
  docId: string | undefined;
  tagFilter: TagFilter;
  linkPreviewDocId: string | null;
};

export default function useVaultData({
  activeCampaignId,
  docId,
  tagFilter,
  linkPreviewDocId
}: UseVaultDataInput) {
  const folders = useSupabaseQuery(
    async () => {
      if (!activeCampaignId) return [];
      const list = await listFolders(activeCampaignId);
      const order = new Map([
        ["Factions", 0],
        ["Religions", 1],
        ["Magic & Cosmology", 2],
        ["History & Ages", 3],
        ["Places", 4],
        ["Lore", 5],
        ["People", 6]
      ]);
      return list.sort((a, b) => {
        const aOrder = order.get(a.name) ?? 100;
        const bOrder = order.get(b.name) ?? 100;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    },
    [activeCampaignId],
    [],
    { tables: ["folders"] }
  );

  const docs = useSupabaseQuery(
    async () => {
      if (!activeCampaignId) return [];
      const list = await listDocs(activeCampaignId);
      return list.sort((a, b) => a.title.localeCompare(b.title));
    },
    [activeCampaignId],
    [],
    { tables: ["docs"] }
  );

  const trashedDocs = useSupabaseQuery(
    () => (activeCampaignId ? listTrashedDocs(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["docs"] }
  );

  const trashedFolders = useSupabaseQuery(
    () => (activeCampaignId ? listTrashedFolders(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["folders"] }
  );

  const currentDoc = useSupabaseQuery(
    () => (docId ? getDocById(docId) : Promise.resolve(undefined)),
    [docId],
    undefined,
    { tables: ["docs"] }
  );

  const linkPreviewDoc = useSupabaseQuery(
    async () => {
      if (!linkPreviewDocId) return undefined;
      const doc = await getDocById(linkPreviewDocId);
      if (doc) return { type: "doc" as const, data: doc };
      const ref = await getReferenceById(linkPreviewDocId);
      if (ref) return { type: "reference" as const, data: ref };
      return undefined;
    },
    [linkPreviewDocId],
    undefined,
    { tables: ["docs", "references"] }
  );

  const references = useSupabaseQuery(
    async () => {
      const slugs = [
        "actions",
        "bastions",
        "bestiary",
        "conditions-diseases",
        "decks",
        "deities",
        "items",
        "languages",
        "rewards",
        "psionics",
        "spells",
        "vehicles",
        "recipes",
        "adventures",
        "cults-boons",
        "objects",
        "traps-hazards"
      ];
      return listReferencesBySlugs(slugs);
    },
    [],
    [],
    { tables: ["references"] }
  );

  const bestiaryReferences = useSupabaseQuery(
    async () => {
      const entries = await listReferencesBySlug("bestiary");
      return entries.filter((entry) => entry.rawJson);
    },
    [],
    [],
    { tables: ["references"] }
  );

  const mapPins = useSupabaseQuery(
    async () => {
      if (!currentDoc) return [] as MapPin[];
      const locations = await listMapLocationsByDoc(currentDoc.id);
      if (locations.length === 0) return [] as MapPin[];
      const maps = await listMaps(currentDoc.campaignId);
      const mapMap = new Map(maps.map((map) => [map.id, map]));
      return locations.map((location) => ({
        ...location,
        map: mapMap.get(location.mapId) ?? null
      }));
    },
    [currentDoc?.id],
    [],
    { tables: ["map_locations", "maps"] }
  );

  const npcProfile = useSupabaseQuery(
    async () => {
      if (!currentDoc) return null;
      return getNpcProfile(currentDoc.id);
    },
    [currentDoc?.id],
    null,
    { tables: ["npc_profiles"] }
  );

  const backlinks: BacklinkEntry[] = useSupabaseQuery(
    async () => {
      if (!currentDoc) return [] as BacklinkEntry[];
      const results = await listBacklinks(currentDoc.id);
      const entries = results
        .map((result) => {
          const source = result?.source;
          if (!source) return null;
          const marker = `[[${currentDoc.title}`;
          const context = extractBacklinkContext(source.body, marker);
          return { source, ...context };
        })
        .filter(
          (entry): entry is {
            source: Doc;
            heading: string | null;
            subheading: string | null;
            line: string;
          } => Boolean(entry && !isIndexDoc(entry.source))
        );
      return entries;
    },
    [currentDoc?.id, currentDoc?.title],
    [] as BacklinkEntry[],
    { tables: ["edges", "docs"] }
  );

  const tags = useSupabaseQuery(
    async () => {
      if (!currentDoc) return [];
      return listTagsForDoc(currentDoc.id);
    },
    [currentDoc?.id],
    [],
    { tables: ["tags"] }
  );

  const tagResults = useSupabaseQuery(
    async () => {
      if (!tagFilter || !activeCampaignId) return [];
      return listDocsWithTag(tagFilter.type, tagFilter.value, activeCampaignId);
    },
    [tagFilter?.type, tagFilter?.value, activeCampaignId],
    [],
    { tables: ["tags", "docs"] }
  );

  const worldbuildContext = useSupabaseQuery(
    async () => {
      if (!currentDoc) return null;
      return buildWorldContext(currentDoc.id);
    },
    [currentDoc?.id],
    null,
    { tables: ["docs", "edges", "tags", "folders"] }
  );

  const chatTagOptions = useSupabaseQuery(
    async () => {
      if (!docs || docs.length === 0) return [];
      const docIds = docs.map((doc) => doc.id);
      if (docIds.length === 0) return [];
      const tags = await listTagsForDocs(docIds);
      const unique = new Map<string, { type: string; value: string }>();
      tags.forEach((tag) => {
        const key = `${tag.type}:${tag.value}`;
        if (!unique.has(key)) {
          unique.set(key, { type: tag.type, value: tag.value });
        }
      });
      return Array.from(unique.values()).sort((a, b) => {
        if (a.type === b.type) return a.value.localeCompare(b.value);
        return a.type.localeCompare(b.type);
      });
    },
    [activeCampaignId, docs?.length],
    [],
    { tables: ["tags"] }
  );

  return {
    folders,
    docs,
    trashedDocs,
    trashedFolders,
    currentDoc,
    linkPreviewDoc,
    references,
    bestiaryReferences,
    mapPins,
    npcProfile,
    backlinks,
    tags,
    tagResults,
    worldbuildContext,
    chatTagOptions
  };
}
