import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import CampaignPanel from "../ui/CampaignPanel";
import Sidebar from "../ui/Sidebar";
import PagePanel from "../ui/PagePanel";
import Marginalia, { type MapPin } from "../ui/Marginalia";
import QuickOpen from "../ui/QuickOpen";
import CampaignModal from "../ui/components/CampaignModal";
import PromptModal from "../ui/components/PromptModal";
import ConfirmModal from "../ui/components/ConfirmModal";
import NpcCreateModal from "../ui/components/NpcCreateModal";
import TrashPanel from "../ui/TrashPanel";
import { db } from "../vault/db";
import {
  createCampaign,
  createDoc,
  createFolder,
  getDocByTitle,
  listBacklinks,
  listCampaigns,
  listDocsWithTag,
  listTagsForDoc,
  listTrashedDocs,
  listTrashedFolders,
  moveDoc,
  purgeDoc,
  purgeFolder,
  renameDoc,
  renameFolder,
  restoreDoc,
  restoreFolder,
  saveDocContent,
  setDocSortOrder,
  updateAllFolderIndexes,
  updateCampaign,
  setSetting,
  getSetting,
  getNpcProfile,
  setNpcProfile,
  trashDoc,
  trashFolder
} from "../vault/queries";
import {
  migrateIndexDocsToSubfolders,
  removeDocsMatchingSubfolders,
  seedCampaignIfNeeded,
  migrateImplicitWorld
} from "../vault/seed";
import { seedReferencesIfNeeded } from "../vault/referenceSeed";
import { isIndexDoc } from "../vault/indexing";
import { listReferencesBySlug } from "../vault/queries";
import { templates } from "../lib/templates";
import { extractBacklinkContext } from "../lib/text";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";
import { useHotkeys } from "../lib/useHotkeys";
import type { Doc, Folder } from "../vault/types";
import { buildWorldContext, type WorldContext } from "../prep/context";
import {
  buildWorldbuildContextPreview,
  buildWorldbuildInputs,
  buildWorldbuildPrompt,
  parseWorldbuildDrafts,
  type WorldbuildAnchor,
  type WorldbuildAnchorType,
  type WorldbuildDraft,
  type WorldbuildResult
} from "../ai/worldbuild";
import plotLinesPrompt from "../ai/prompts/plotLines.md?raw";
import cityBuilderPrompt from "../ai/prompts/cityBuilder.md?raw";
import adventureHooksPrompt from "../ai/prompts/adventureHooks.md?raw";
import highLevelPlotPrompt from "../ai/prompts/highLevelPlot.md?raw";
import { createId } from "../lib/id";
import { sendPromptToProvider, type AiProvider } from "../ai/client";
import { parseLinks, parseTags } from "../vault/parser";

function collectFolderPath(folderId: string | null, folderMap: Map<string, Folder>) {
  const names: string[] = [];
  let current = folderId ? folderMap.get(folderId) ?? null : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) ?? null : null;
  }
  return names.map((name) => name.toLowerCase());
}

function classifyAnchorType(
  doc: Doc,
  folderMap: Map<string, Folder>
): WorldbuildAnchorType {
  const path = collectFolderPath(doc.folderId ?? null, folderMap);
  if (path.includes("factions")) return "Faction";
  if (path.includes("religions")) return "Religion";
  if (path.includes("notable figures") || path.includes("people")) return "Figure";
  if (path.includes("regions") || path.includes("places") || path.includes("locations")) {
    return "Region";
  }
  return "Other";
}

export default function VaultPage() {
  const { docId, folderName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isTrashView = location.pathname === "/trash";
  const [quickOpen, setQuickOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tagFilter, setTagFilter] = useState<{ type: string; value: string } | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"worldview" | "timeline" | "maps">(
    "worldview"
  );
  const [pageMode, setPageMode] = useState<"edit" | "preview">(() => {
    if (typeof window === "undefined") return "edit";
    const stored = window.localStorage.getItem("pageMode");
    return stored === "preview" ? "preview" : "edit";
  });
  const [linkPreviewDocId, setLinkPreviewDocId] = useState<string | null>(null);
  const [worldbuildTone, setWorldbuildTone] = useState("political intrigue");
  const [selectedAnchorIds, setSelectedAnchorIds] = useState<string[]>([]);
  const [worldbuildResults, setWorldbuildResults] = useState<WorldbuildResult[]>([]);
  const [worldbuildLoading, setWorldbuildLoading] = useState({
    plotLines: false,
    cityBuilder: false,
    adventureHooks: false,
    highLevelPlot: false
  });
  const [draftQueue, setDraftQueue] = useState<{
    drafts: WorldbuildDraft[];
    index: number;
  } | null>(null);
  const [aiProvider, setAiProvider] = useState("none");
  const [aiMessages, setAiMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: number }>
  >([]);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState("");
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [templatePrompt, setTemplatePrompt] = useState<{
    template: typeof templates[number];
    folderId: string | null;
  } | null>(null);
  const [npcPrompt, setNpcPrompt] = useState<{
    template: typeof templates[number];
    folderId: string | null;
  } | null>(null);
  const [linkCreatePrompt, setLinkCreatePrompt] = useState<string | null>(null);
  const [docDeletePrompt, setDocDeletePrompt] = useState<Doc | null>(null);
  const [purgePrompt, setPurgePrompt] = useState<{
    type: "doc" | "folder";
    id: string;
    title: string;
  } | null>(null);

  const campaigns = useLiveQuery(() => listCampaigns(), [], []);
  const folders = useLiveQuery(
    async () => {
      if (!activeCampaignId) return [];
      const list = await db.folders.where("campaignId").equals(activeCampaignId).toArray();
      const order = new Map([
        ["Factions", 0],
        ["Religions", 1],
        ["Magic & Cosmology", 2],
        ["History & Ages", 3],
        ["Places", 4],
        ["Lore", 5],
        ["People", 6]
      ]);
      return list
        .filter((folder) => !folder.deletedAt)
        .sort((a, b) => {
        const aOrder = order.get(a.name) ?? 100;
        const bOrder = order.get(b.name) ?? 100;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    },
    [activeCampaignId],
    []
  );
  const docs = useLiveQuery(
    () =>
      activeCampaignId
        ? db.docs
            .where("campaignId")
            .equals(activeCampaignId)
            .toArray()
            .then((list) =>
              list
                .filter((doc) => !doc.deletedAt)
                .sort((a, b) => a.title.localeCompare(b.title))
            )
        : Promise.resolve([]),
    [activeCampaignId],
    []
  );
  const trashedDocs = useLiveQuery(
    () => (activeCampaignId ? listTrashedDocs(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    []
  );
  const trashedFolders = useLiveQuery(
    () => (activeCampaignId ? listTrashedFolders(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    []
  );
  const currentDoc = useLiveQuery(
    () => (docId ? db.docs.get(docId) : Promise.resolve(undefined)),
    [docId]
  );
  const linkPreviewDoc = useLiveQuery(async () => {
    if (!linkPreviewDocId) return undefined;
    const doc = await db.docs.get(linkPreviewDocId);
    if (doc) return { type: "doc" as const, data: doc };
    const ref = await db.references.get(linkPreviewDocId);
    if (ref) return { type: "reference" as const, data: ref };
    return undefined;
  }, [linkPreviewDocId]);
  const references = useLiveQuery(async () => {
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
    const results = await Promise.all(slugs.map((slug) => listReferencesBySlug(slug)));
    return results.flat();
  }, []);
  const bestiaryReferences = useLiveQuery(async () => {
    const entries = await db.references.where("slug").equals("bestiary").toArray();
    return entries.filter((entry) => entry.rawJson);
  }, []);
  const mapPins = useLiveQuery(async () => {
    if (!currentDoc) return [] as MapPin[];
    const locations = await db.mapLocations.where("docId").equals(currentDoc.id).toArray();
    if (locations.length === 0) return [] as MapPin[];
    const maps = await db.maps.bulkGet(locations.map((location) => location.mapId));
    return locations.map((location, index) => ({
      ...location,
      map: maps[index] ?? null
    }));
  }, [currentDoc?.id, navigate]);
  const npcProfile = useLiveQuery(async () => {
    if (!currentDoc) return null;
    return getNpcProfile(currentDoc.id);
  }, [currentDoc?.id]);

  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const activeCampaign = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );
  const npcCreature = useMemo(() => {
    if (!npcProfile?.creatureId) return null;
    const creature = (bestiaryReferences ?? []).find(
      (entry) => entry.id === npcProfile.creatureId
    );
    if (!creature) return null;
    return { name: creature.name, rawJson: creature.rawJson };
  }, [npcProfile?.creatureId, bestiaryReferences]);
  const activeDraft = draftQueue ? draftQueue.drafts[draftQueue.index] : null;
  const isPeopleDoc = useMemo(() => {
    if (!currentDoc?.folderId) return false;
    const folder = (folders ?? []).find((entry) => entry.id === currentDoc.folderId);
    return folder ? folder.name.toLowerCase().includes("people") : false;
  }, [currentDoc?.folderId, folders]);

  useEffect(() => {
    const ensureCampaign = async () => {
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await seedCampaignIfNeeded(storedCampaignId);
        await migrateImplicitWorld(storedCampaignId);
        await updateAllFolderIndexes(storedCampaignId);
        await migrateIndexDocsToSubfolders(storedCampaignId);
        await removeDocsMatchingSubfolders(storedCampaignId);
        return;
      }

      const existing = await db.campaigns.toArray();
      if (existing.length > 0) {
        const first = existing[0];
        setActiveCampaignId(first.id);
        await setSetting("activeCampaignId", first.id);
        await seedCampaignIfNeeded(first.id);
        await migrateImplicitWorld(first.id);
        await updateAllFolderIndexes(first.id);
        await migrateIndexDocsToSubfolders(first.id);
        await removeDocsMatchingSubfolders(first.id);
        return;
      }

      const campaign = await createCampaign("Campaign One", "");
      setActiveCampaignId(campaign.id);
      await setSetting("activeCampaignId", campaign.id);
      await seedCampaignIfNeeded(campaign.id);
      await migrateImplicitWorld(campaign.id);
      await updateAllFolderIndexes(campaign.id);
      await migrateIndexDocsToSubfolders(campaign.id);
      await removeDocsMatchingSubfolders(campaign.id);
    };

    ensureCampaign().catch(() => undefined);
  }, []);

  useEffect(() => {
    seedReferencesIfNeeded().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (currentDoc) {
      if (currentDoc.deletedAt) {
        navigate("/trash");
        return;
      }
      const targetNames = [
        "Factions",
        "Religions",
        "Regions",
        "Magic & Cosmology",
        "History & Ages"
      ];
      const namePattern = targetNames
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      if (currentDoc.title === "Welcome") {
        const canonicalLine =
          "Begin with [[folder:Factions]], [[folder:Religions]], [[folder:Regions]], [[folder:Magic & Cosmology]], and [[folder:History & Ages]].";
        const nextBody = currentDoc.body
          .split("\n")
          .map((line) => {
            if (!line.startsWith("Begin with ")) return line;
            if (line.includes("folder:") && !line.includes("[[folder:")) {
              return canonicalLine;
            }
            return canonicalLine;
          })
          .join("\n");
        if (nextBody !== currentDoc.body) {
          saveDocContent(currentDoc.id, nextBody).catch(() => undefined);
        }
        setTitleDraft(currentDoc.title);
        setBodyDraft(nextBody);
        debouncedSave.cancel?.();
        debouncedRename.cancel?.();
        return;
      }
      if (
        currentDoc.body.includes("Worldbuilder is a spellbook of systems") &&
        (currentDoc.title !== "Welcome" || currentDoc.title.includes("folder:"))
      ) {
        renameDoc(currentDoc.id, "Welcome").catch(() => undefined);
        setTitleDraft("Welcome");
      } else {
        setTitleDraft(currentDoc.title);
      }
      setBodyDraft(currentDoc.body);
    }
    debouncedSave.cancel?.();
    debouncedRename.cancel?.();
  }, [currentDoc?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentDoc) return;
    window.localStorage.setItem("wb:lastDocId", currentDoc.id);
  }, [currentDoc?.id]);

  useEffect(() => {
    setLinkPreviewDocId(null);
  }, [currentDoc?.id]);

  useEffect(() => {
    if (currentDoc && activeCampaignId && currentDoc.campaignId !== activeCampaignId) {
      navigate("/");
    }
  }, [currentDoc?.campaignId, activeCampaignId, navigate]);

  useEffect(() => {
    if (!folderName || !activeCampaignId) return;
    const openFolderIndex = async () => {
      const decoded = decodeURIComponent(folderName);
      const folder = await db.folders
        .where("campaignId")
        .equals(activeCampaignId)
        .filter(
          (candidate) =>
            !candidate.deletedAt && candidate.name.toLowerCase() === decoded.toLowerCase()
        )
        .first();
      if (!folder) return;
      await updateAllFolderIndexes(activeCampaignId);
      const indexDoc = await getDocByTitle(`${folder.name} Index`, activeCampaignId);
      if (indexDoc) {
        navigate(`/doc/${indexDoc.id}`);
      }
    };
    openFolderIndex().catch(() => undefined);
  }, [folderName, activeCampaignId, navigate]);

  useEffect(() => {
    setTagFilter(null);
  }, [activeCampaignId]);

  useEffect(() => {
    const applyTheme = async () => {
      const stored = await getSetting("theme");
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      }
    };
    applyTheme().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const applyMode = async () => {
      const storedLocal = window.localStorage.getItem("pageMode");
      if (storedLocal === "edit" || storedLocal === "preview") return;
      const stored = await getSetting("pageMode");
      if (stored === "edit" || stored === "preview") {
        setPageMode(stored);
        window.localStorage.setItem("pageMode", stored);
      }
    };
    applyMode().catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadAiProvider = async () => {
      const stored = await getSetting("aiProvider");
      if (stored) setAiProvider(stored);
    };
    loadAiProvider().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeCampaignId) {
      setAiMessages([]);
      return;
    }
    const stored = window.localStorage.getItem(`wb:aiChat:${activeCampaignId}`);
    if (!stored) {
      setAiMessages([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setAiMessages(
          parsed.filter(
            (entry) =>
              entry &&
              (entry.role === "user" || entry.role === "assistant") &&
              typeof entry.content === "string"
          )
        );
      }
    } catch {
      setAiMessages([]);
    }
  }, [activeCampaignId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeCampaignId) return;
    window.localStorage.setItem(
      `wb:aiChat:${activeCampaignId}`,
      JSON.stringify(aiMessages)
    );
  }, [aiMessages, activeCampaignId]);


  useEffect(() => {
    window.localStorage.setItem("pageMode", pageMode);
    setSetting("pageMode", pageMode).catch(() => undefined);
  }, [pageMode]);

  const debouncedSave = useDebouncedCallback((nextBody: string) => {
    if (!currentDoc) return;
    saveDocContent(currentDoc.id, nextBody).catch(() => undefined);
  }, 500);

  const debouncedRename = useDebouncedCallback((nextTitle: string) => {
    if (!currentDoc) return;
    renameDoc(currentDoc.id, nextTitle).catch(() => undefined);
  }, 500);

  useEffect(() => {
    if (!activeCampaignId) return;
    updateAllFolderIndexes(activeCampaignId).catch(() => undefined);
  }, [activeCampaignId, docs, folders]);

  useEffect(() => {
    if (!activeCampaignId) return;
    const cleanupFolderDocs = async () => {
      const candidates = await db.docs
        .where("campaignId")
        .equals(activeCampaignId)
        .filter((doc) => doc.title.toLowerCase().includes("folder:"))
        .toArray();
      const welcomeCandidates = await db.docs
        .where("campaignId")
        .equals(activeCampaignId)
        .filter((doc) => doc.body.includes("Worldbuilder is a spellbook of systems"))
        .toArray();
      if (candidates.length === 0 && welcomeCandidates.length === 0) return;
      await db.transaction("rw", db.docs, async () => {
        if (welcomeCandidates.length > 0) {
          const sorted = [...welcomeCandidates].sort((a, b) => b.updatedAt - a.updatedAt);
          const keeper = sorted[0];
          await db.docs.update(keeper.id, { title: "Welcome" });
          for (const extra of sorted.slice(1)) {
            await db.docs.delete(extra.id);
          }
        }
        for (const doc of candidates) {
          if (!doc.body.trim()) {
            await db.docs.delete(doc.id);
          }
        }
      });
    };
    cleanupFolderDocs().catch(() => undefined);
  }, [activeCampaignId]);

  const backlinks = useLiveQuery(async () => {
    if (!currentDoc) return [] as { source: Doc; snippet: string }[];
    const results = await listBacklinks(currentDoc.id);
    return results
      .map((result) => {
        const source = result?.source;
        if (!source) return null;
        const marker = `[[${currentDoc.title}`;
        const context = extractBacklinkContext(source.body, marker);
        return { source, ...context };
      })
      .filter(Boolean)
      .filter((entry) => !isIndexDoc(entry.source)) as {
      source: Doc;
      heading: string | null;
      subheading: string | null;
      line: string;
    }[];
  }, [currentDoc?.id, currentDoc?.title]);

  const tags = useLiveQuery(async () => {
    if (!currentDoc) return [];
    return listTagsForDoc(currentDoc.id);
  }, [currentDoc?.id]);

  const tagResults = useLiveQuery(async () => {
    if (!tagFilter || !activeCampaignId) return [];
    return listDocsWithTag(tagFilter.type, tagFilter.value, activeCampaignId);
  }, [tagFilter?.type, tagFilter?.value, activeCampaignId]);

  const worldbuildContext = useLiveQuery(async () => {
    if (!currentDoc) return null;
    return buildWorldContext(currentDoc.id);
  }, [currentDoc?.id]);
  const chatTagOptions = useLiveQuery(
    async () => {
      if (!docs || docs.length === 0) return [];
      const docIds = docs.map((doc) => doc.id);
      if (docIds.length === 0) return [];
      const tags = await db.tags.where("docId").anyOf(docIds).toArray();
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
    []
  );

  const worldbuildAnchors = useMemo(() => {
    if (!worldbuildContext || !folders) return [] as WorldbuildAnchor[];
    const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));
    const candidates = [
      ...worldbuildContext.linkedDocs,
      ...worldbuildContext.backlinks,
      ...worldbuildContext.relatedDocsByTag.flatMap((entry) => entry.docs)
    ];
    const unique = new Map<string, WorldbuildAnchor>();
    candidates.forEach((doc) => {
      const type = classifyAnchorType(doc, folderMap);
      if (type === "Other") return;
      if (!unique.has(doc.id)) {
        unique.set(doc.id, { id: doc.id, title: doc.title, type });
      }
    });
    return Array.from(unique.values()).slice(0, 12);
  }, [worldbuildContext, folders]);

  useEffect(() => {
    if (!currentDoc) {
      setSelectedAnchorIds([]);
      setWorldbuildResults([]);
      setDraftQueue(null);
      return;
    }
    setSelectedAnchorIds((prev) => {
      const available = new Set(worldbuildAnchors.map((anchor) => anchor.id));
      const filtered = prev.filter((id) => available.has(id));
      if (filtered.length > 0) return filtered;
      return worldbuildAnchors.slice(0, 4).map((anchor) => anchor.id);
    });
    setWorldbuildResults([]);
    setWorldbuildLoading({
      plotLines: false,
      cityBuilder: false,
      adventureHooks: false,
      highLevelPlot: false
    });
    setDraftQueue(null);
  }, [currentDoc?.id, worldbuildAnchors]);

  const toggleWorldbuildAnchor = (anchorId: string) => {
    setSelectedAnchorIds((prev) =>
      prev.includes(anchorId) ? prev.filter((id) => id !== anchorId) : [...prev, anchorId]
    );
  };

  const insertWorldbuildContent = (content: string) => {
    if (!currentDoc) return;
    setBodyDraft((prev) => {
      const next = prev.trim() ? `${prev}\n\n${content}` : content;
      debouncedSave(next);
      return next;
    });
  };

  const resolveDraftFolderId = (folderHint: WorldbuildDraft["folderHint"]) => {
    if (!folders) return null;
    if (folderHint === "Other" || folderHint === "World") return null;
    const target = folders.find(
      (folder) => folder.name.toLowerCase() === folderHint.toLowerCase()
    );
    return target?.id ?? null;
  };

  const normalizeTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("@")) return trimmed;
    if (trimmed.startsWith("#")) return `@${trimmed.slice(1)}`;
    return `@${trimmed}`;
  };

  const buildDraftBody = (draft: WorldbuildDraft) => {
    const linkLines = draft.linksTo
      .map((link) => link.trim())
      .filter(Boolean)
      .map((link) => `[[${link}]]`);
    const tagLines = draft.tags.map(normalizeTag).filter(Boolean);
    const parts = [draft.bodyMarkdown.trim()].filter(Boolean);
    if (linkLines.length > 0) parts.push(linkLines.join("\n"));
    if (tagLines.length > 0) parts.push(tagLines.join("\n"));
    return parts.join("\n\n");
  };

  const handleCreateDraftDocs = (drafts: WorldbuildDraft[]) => {
    if (!drafts || drafts.length === 0) return;
    setDraftQueue({ drafts, index: 0 });
  };

  const handleGenerateWorldbuild = async (
    kind: WorldbuildResult["kind"],
    template: string
  ) => {
    if (!currentDoc) return;
    setWorldbuildLoading((prev) => ({ ...prev, [kind]: true }));
    try {
      const context = worldbuildContext ?? (await buildWorldContext(currentDoc.id));
      if (!context) return;
      const selectedAnchors = worldbuildAnchors.filter((anchor) =>
        selectedAnchorIds.includes(anchor.id)
      );
      const anchorsToUse =
        selectedAnchors.length > 0 ? selectedAnchors : worldbuildAnchors.slice(0, 4);
      const inputs = buildWorldbuildInputs(context, anchorsToUse, worldbuildTone);
      const prompt = buildWorldbuildPrompt(template, inputs);
      const drafts = parseWorldbuildDrafts(prompt) ?? undefined;
      const result: WorldbuildResult = {
        id: createId(),
        kind,
        provider:
          aiProvider && aiProvider !== "none"
            ? `Configured: ${aiProvider}`
            : "Template (no AI configured)",
        contextPreview: buildWorldbuildContextPreview(context, anchorsToUse),
        content: prompt,
        createdAt: Date.now(),
        drafts,
        status: "ready"
      };
      // TODO: Connect optional AI provider to execute prompts and store real outputs.
      setWorldbuildResults((prev) => [result, ...prev]);
    } finally {
      setWorldbuildLoading((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const handleGeneratePlotLines = () =>
    handleGenerateWorldbuild("plotLines", plotLinesPrompt);

  const handleBuildCity = () => handleGenerateWorldbuild("cityBuilder", cityBuilderPrompt);

  const handleGenerateHooks = () =>
    handleGenerateWorldbuild("adventureHooks", adventureHooksPrompt);

  const handleGenerateHighLevelPlot = () =>
    handleGenerateWorldbuild("highLevelPlot", highLevelPlotPrompt);

  const buildExcerpt = (body: string, limit = 360) => {
    const withoutLinks = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
    const withoutTags = withoutLinks.replace(/@[a-zA-Z]+:[\w-]+/g, "");
    const normalized = withoutTags.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit).trim()}...`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "unknown";
    return new Date(timestamp).toISOString().slice(0, 10);
  };

  const buildWorldContextSummary = (context: WorldContext) => {
    const tagLabels = context.currentDoc.tags.map(
      (tag) => `@${tag.type}:${tag.value}`
    );
    const linkedTitles = context.linkedDocs.slice(0, 6).map((doc) => doc.title);
    const backlinkTitles = context.backlinks.slice(0, 6).map((doc) => doc.title);
    const relatedTags = context.relatedDocsByTag
      .filter((entry) => entry.docs.length > 0)
      .slice(0, 4)
      .map(
        (entry) =>
          `@${entry.type}:${entry.value} -> ${entry.docs
            .slice(0, 4)
            .map((doc) => doc.title)
            .join(", ")}`
      );
    const recentTitles = context.recentlyUpdatedDocs
      .slice(0, 6)
      .map((doc) => `${doc.title} (${formatDate(doc.updatedAt)})`);
    const folderName = context.folderContext.folder?.name ?? "None";
    const siblingTitles = context.folderContext.siblings
      .slice(0, 6)
      .map((doc) => doc.title);

    return [
      "World Context:",
      `Current Page: ${context.currentDoc.title}`,
      `Tags: ${tagLabels.length > 0 ? tagLabels.join(", ") : "None"}`,
      context.currentDoc.excerpt ? `Excerpt: ${context.currentDoc.excerpt}` : null,
      linkedTitles.length > 0 ? `Linked Pages: ${linkedTitles.join(", ")}` : null,
      backlinkTitles.length > 0 ? `Backlinks: ${backlinkTitles.join(", ")}` : null,
      relatedTags.length > 0 ? `Related Tags: ${relatedTags.join(" | ")}` : null,
      recentTitles.length > 0 ? `Recently Updated: ${recentTitles.join(", ")}` : null,
      `Folder: ${folderName}`,
      siblingTitles.length > 0 ? `Sibling Pages: ${siblingTitles.join(", ")}` : null
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildChatPrompt = async (nextMessage: string) => {
    const synopsis = activeCampaign?.synopsis?.trim() || "None provided.";
    const name = activeCampaign?.name?.trim() || "Untitled Campaign";
    const history = aiMessages.slice(-8).map((message) => {
      const roleLabel = message.role === "user" ? "User" : "Assistant";
      return `${roleLabel}: ${message.content}`;
    });
    const context =
      worldbuildContext ?? (currentDoc ? await buildWorldContext(currentDoc.id) : null);
    const worldContextSection = context ? buildWorldContextSummary(context) : null;
    const linkTargets = parseLinks(nextMessage);
    const tagTargets = parseTags(nextMessage);
    const linkDocs: Array<{ label: string; excerpt: string }> = [];
    const missingLinks: string[] = [];
    const seenDocIds = new Set<string>();

    for (const link of linkTargets) {
      let doc = null;
      if (link.docId) {
        doc = await db.docs.get(link.docId);
      } else if (activeCampaignId) {
        doc = await db.docs
          .where("campaignId")
          .equals(activeCampaignId)
          .filter(
            (candidate) =>
              !candidate.deletedAt &&
              candidate.title.toLowerCase() === link.targetTitle.toLowerCase()
          )
          .first();
      }
      if (doc && !doc.deletedAt && !seenDocIds.has(doc.id)) {
        seenDocIds.add(doc.id);
        linkDocs.push({ label: doc.title, excerpt: buildExcerpt(doc.body ?? "") });
      } else {
        missingLinks.push(link.targetTitle);
      }
    }

    const tagContexts: Array<{ tag: string; docs: string[] }> = [];
    if (activeCampaignId) {
      for (const tag of tagTargets) {
        const docsWithTag = await listDocsWithTag(tag.type, tag.value, activeCampaignId);
        const titles = docsWithTag
          .filter((doc) => !doc.deletedAt)
          .slice(0, 4)
          .map((doc) => doc.title);
        tagContexts.push({ tag: `@${tag.type}:${tag.value}`, docs: titles });
      }
    }

    const referencedLinksSection =
      linkDocs.length > 0 || missingLinks.length > 0
        ? [
            "Referenced Links:",
            ...linkDocs.map((doc) => `- ${doc.label}: ${doc.excerpt || "No excerpt."}`),
            ...missingLinks.map((label) => `- Missing: ${label}`)
          ].join("\n")
        : null;

    const referencedTagsSection =
      tagContexts.length > 0
        ? [
            "Referenced Tags:",
            ...tagContexts.map((entry) =>
              entry.docs.length > 0
                ? `- ${entry.tag}: ${entry.docs.join(", ")}`
                : `- ${entry.tag}: (no matching docs)`
            )
          ].join("\n")
        : null;

    return [
      "You are a worldbuilding assistant. Stay consistent with the campaign synopsis.",
      "Use existing world context when possible. Keep outputs structured and actionable.",
      `Campaign: ${name}`,
      `Synopsis: ${synopsis}`,
      worldContextSection,
      referencedLinksSection,
      referencedTagsSection,
      "Conversation:",
      ...history,
      `User: ${nextMessage}`,
      "Assistant:"
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleSendAiChat = async () => {
    if (!aiInput.trim()) return;
    const nextMessage = aiInput.trim();
    console.debug("[WB] AI chat send: start", { provider: aiProvider });
    setAiError("");
    setAiSending(true);
    setAiInput("");
    const userEntry = {
      id: createId(),
      role: "user" as const,
      content: nextMessage,
      createdAt: Date.now()
    };
    setAiMessages((prev) => [...prev, userEntry]);
    try {
      const provider = (aiProvider || "none") as AiProvider;
      const [
        openAiKey,
        openAiModel,
        openAiBaseUrl,
        ollamaModel,
        ollamaBaseUrl
      ] = await Promise.all([
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiOllamaModel"),
        getSetting("aiOllamaBaseUrl")
      ]);
      const prompt = await buildChatPrompt(nextMessage);
      console.debug("[WB] AI chat send: prompt built", {
        provider,
        promptLength: prompt.length
      });
      const response = await sendPromptToProvider({
        provider,
        prompt,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      console.debug("[WB] AI chat send: response received", {
        providerLabel: response.providerLabel,
        contentLength: response.content.length
      });
      const assistantEntry = {
        id: createId(),
        role: "assistant" as const,
        content: response.content,
        createdAt: Date.now()
      };
      setAiMessages((prev) => [...prev, assistantEntry]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      console.debug("[WB] AI chat send: error", message);
      setAiError(message);
    } finally {
      console.debug("[WB] AI chat send: done");
      setAiSending(false);
    }
  };

  const handleClearAiChat = () => {
    setAiMessages([]);
    setAiError("");
  };

  const handleSendWorldbuild = async (resultId: string) => {
    setWorldbuildResults((prev) =>
      prev.map((entry) =>
        entry.id === resultId ? { ...entry, status: "sending", error: undefined } : entry
      )
    );
    try {
      const provider = (aiProvider || "none") as AiProvider;
      const [
        openAiKey,
        openAiModel,
        openAiBaseUrl,
        ollamaModel,
        ollamaBaseUrl
      ] = await Promise.all([
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiOllamaModel"),
        getSetting("aiOllamaBaseUrl")
      ]);
      const target = worldbuildResults.find((entry) => entry.id === resultId);
      if (!target) return;
      const response = await sendPromptToProvider({
        provider,
        prompt: target.content,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      setWorldbuildResults((prev) =>
        prev.map((entry) =>
          entry.id === resultId
            ? {
                ...entry,
                content: response.content,
                provider: response.providerLabel,
                status: "ready",
                error: undefined
              }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      setWorldbuildResults((prev) =>
        prev.map((entry) =>
          entry.id === resultId
            ? { ...entry, status: "error", error: message }
            : entry
        )
      );
    }
  };

  const openDoc = (id: string) => {
    navigate(`/doc/${id}`);
  };

  const handleCreateCampaign = () => {
    setCampaignModalOpen(true);
  };

  const handleSubmitCampaign = async (name: string, synopsis: string) => {
    const campaign = await createCampaign(name, synopsis);
    setActiveCampaignId(campaign.id);
    await setSetting("activeCampaignId", campaign.id);
    await seedCampaignIfNeeded(campaign.id);
    await migrateImplicitWorld(campaign.id);
    const welcome = await getDocByTitle("Welcome", campaign.id);
    if (welcome) {
      navigate(`/doc/${welcome.id}`);
    }
  };


  const applyTemplateTitle = (template: string, title: string) => {
    const lines = template.split("\n");
    if (lines[0]?.startsWith("# ")) {
      lines[0] = `# ${title}`;
      return lines.join("\n");
    }
    return template;
  };

  const openDocByLink = async (target: string) => {
    if (!activeCampaignId) return;
    const normalized = target.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
    console.debug("[WB] openDocByLink", { target, normalized });
    if (normalized.startsWith("doc:")) {
      const payload = normalized.slice(4);
      const [id, aliasRaw] = payload.split("|");
      const alias = aliasRaw?.trim();
      console.debug("[WB] openDocByLink doc id", { id });
      if (alias) {
        const folderMatch = await db.folders
          .where("campaignId")
          .equals(activeCampaignId)
          .filter(
            (candidate) =>
              !candidate.deletedAt && candidate.name.toLowerCase() === alias.toLowerCase()
          )
          .first();
        if (folderMatch) {
          await updateAllFolderIndexes(activeCampaignId);
          const indexDoc = await getDocByTitle(`${folderMatch.name} Index`, activeCampaignId);
          if (indexDoc) {
            openDoc(indexDoc.id);
            return;
          }
        }
      }
      const existing = await db.docs.get(id);
      console.debug("[WB] openDocByLink doc found", { found: Boolean(existing) });
      if (existing && !existing.deletedAt) {
        if (currentDoc && existing.id === currentDoc.id && alias) {
          const folderMatch = await db.folders
            .where("campaignId")
            .equals(activeCampaignId)
            .filter(
              (candidate) =>
                !candidate.deletedAt && candidate.name.toLowerCase() === alias.toLowerCase()
            )
            .first();
          if (folderMatch) {
            await updateAllFolderIndexes(activeCampaignId);
            const indexDoc = await getDocByTitle(`${folderMatch.name} Index`, activeCampaignId);
            if (indexDoc) {
              openDoc(indexDoc.id);
              return;
            }
          }
        }
        openDoc(existing.id);
      }
      return;
    }
    if (normalized.startsWith("folder:")) {
      const folderName = decodeURIComponent(normalized.slice("folder:".length)).trim();
      if (!folderName) return;
      navigate(`/folder/${encodeURIComponent(folderName)}`);
      const folder = await db.folders
        .where("campaignId")
        .equals(activeCampaignId)
        .filter(
          (candidate) =>
            !candidate.deletedAt &&
            candidate.name.toLowerCase() === folderName.toLowerCase()
        )
        .first();
      if (folder) {
        await updateAllFolderIndexes(activeCampaignId);
        let indexDoc = await getDocByTitle(`${folder.name} Index`, activeCampaignId);
        if (!indexDoc) {
          indexDoc = await createDoc(`${folder.name} Index`, folder.id, activeCampaignId);
          await updateAllFolderIndexes(activeCampaignId);
        }
        if (indexDoc) {
          openDoc(indexDoc.id);
          return;
        }
      }
      return;
    }
    if (normalized.startsWith("ref:")) {
      const payload = normalized.slice(4);
      const [slug, entryId] = payload.split("|")[0]?.split(":") ?? [];
      if (slug && entryId) {
        navigate(`/reference/${slug}?entry=${entryId}`);
        return;
      }
    }
    const existing = await getDocByTitle(normalized, activeCampaignId);
    if (existing) {
      openDoc(existing.id);
      return;
    }
    const folder = await db.folders
      .where("campaignId")
      .equals(activeCampaignId)
      .filter(
        (candidate) =>
          !candidate.deletedAt &&
          candidate.name.toLowerCase() === normalized.toLowerCase()
      )
      .first();
    if (folder) {
      await updateAllFolderIndexes(activeCampaignId);
      const indexDoc = await getDocByTitle(`${folder.name} Index`, activeCampaignId);
      if (indexDoc) {
        openDoc(indexDoc.id);
        return;
      }
    }
    if (!normalized.startsWith("folder:")) {
      setLinkCreatePrompt(normalized);
    }
  };

  const handleCreateDoc = async (folderId: string | null) => {
    if (!activeCampaignId) return;
    const doc = await createDoc("Untitled Page", folderId, activeCampaignId);
    openDoc(doc.id);
  };

  const handleCreateDocFromTemplate = async (
    template: typeof templates[number],
    folderId: string | null
  ) => {
    if (!activeCampaignId) return;
    if (template.id === "npc") {
      setNpcPrompt({ template, folderId });
    } else {
      setTemplatePrompt({ template, folderId });
    }
  };

  useHotkeys([
    {
      combo: "cmd+p",
      handler: () => setQuickOpen(true)
    },
    {
      combo: "ctrl+p",
      handler: () => setQuickOpen(true)
    },
    {
      combo: "cmd+n",
      handler: () => handleCreateDoc(currentDoc?.folderId ?? null)
    },
    {
      combo: "ctrl+n",
      handler: () => handleCreateDoc(currentDoc?.folderId ?? null)
    }
  ]);

  const quickOpenDocs = useMemo(() => docs ?? [], [docs]);
  const displayDoc = !isTrashView && currentDoc
    ? { ...currentDoc, title: titleDraft, body: bodyDraft }
    : null;

  const handleCursorLink = (target: string | null) => {
    if (!target) {
      setLinkPreviewDocId(null);
      return;
    }
    const trimmed = target.split("|")[0]?.trim();
    if (!trimmed) {
      setLinkPreviewDocId(null);
      return;
    }
    if (trimmed.startsWith("doc:")) {
      setLinkPreviewDocId(trimmed.slice(4));
      return;
    }
    if (trimmed.startsWith("ref:")) {
      const parts = trimmed.split(":");
      if (parts.length >= 3) {
        setLinkPreviewDocId(parts.slice(2).join(":"));
        return;
      }
    }
    if (trimmed.startsWith("folder:")) {
      const folderName = trimmed.slice("folder:".length).trim();
      const matchingFolder = (folders ?? []).find(
        (folder) => folder.name.toLowerCase() === folderName.toLowerCase()
      );
      if (matchingFolder) {
        const indexDoc = (docs ?? []).find(
          (doc) => doc.title === `${matchingFolder.name} Index`
        );
        if (indexDoc) {
          setLinkPreviewDocId(indexDoc.id);
          return;
        }
      }
    }
    const matchingDoc = (docs ?? []).find((doc) => doc.title === trimmed);
    if (matchingDoc) {
      setLinkPreviewDocId(matchingDoc.id);
      return;
    }
    const matchingFolder = (folders ?? []).find(
      (folder) => folder.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchingFolder) {
      const indexDoc = (docs ?? []).find(
        (doc) => doc.title === `${matchingFolder.name} Index`
      );
      if (indexDoc) {
        setLinkPreviewDocId(indexDoc.id);
        return;
      }
    }
    const matchingRef = (references ?? []).find((ref) => ref.name === trimmed);
    if (matchingRef) {
      setLinkPreviewDocId(matchingRef.id);
      return;
    }
    setLinkPreviewDocId(null);
  };

  return (
    <>
      <AppShell
        header={
          <HeaderBar
            docs={docs ?? []}
            onOpenDoc={openDoc}
            onNavigateReference={(slug) => navigate(`/reference/${slug}`)}
            campaigns={campaigns ?? []}
            activeCampaignId={activeCampaignId}
            onSelectCampaign={async (campaignId) => {
              if (!campaignId) return;
              setActiveCampaignId(campaignId);
              setSetting("activeCampaignId", campaignId).catch(() => undefined);
              const welcome = await getDocByTitle("Welcome", campaignId);
              if (welcome) {
                navigate(`/doc/${welcome.id}`);
              } else {
                navigate("/");
              }
            }}
            onCreateCampaign={handleCreateCampaign}
            onOpenSettings={() => navigate("/settings")}
          />
        }
        sidebar={
          <div className="space-y-4">
            <CampaignPanel
              activeCampaign={activeCampaign}
              viewMode={viewMode}
              onSelectView={(view) => {
                setViewMode(view);
                if (view === "timeline") {
                  navigate("/timeline");
                } else if (view === "maps") {
                  navigate("/maps");
                }
              }}
              onCreateCampaign={handleCreateCampaign}
              onUpdateCampaign={(campaignId, updates) => {
                updateCampaign(campaignId, updates).catch(() => undefined);
              }}
            />
            <Sidebar
              folders={folders ?? []}
              docs={docs ?? []}
              activeDocId={currentDoc?.id ?? null}
              onOpenDoc={openDoc}
              onCreateFolder={(name, parentFolderId) => {
                if (!activeCampaignId) return;
                createFolder(name, parentFolderId, activeCampaignId);
              }}
              onRenameFolder={renameFolder}
              onDeleteFolder={trashFolder}
              onReorderDocs={(folderId, orderedDocIds) => {
                if (!activeCampaignId) return;
                setDocSortOrder(folderId, activeCampaignId, orderedDocIds).catch(
                  () => undefined
                );
              }}
              onCreateDoc={handleCreateDoc}
              templates={templates}
              onCreateDocFromTemplate={handleCreateDocFromTemplate}
              activeFolderId={currentDoc?.folderId ?? null}
              onOpenTrash={() => navigate("/trash")}
              trashedCount={
                (trashedDocs?.length ?? 0) + (trashedFolders?.length ?? 0)
              }
            />
          </div>
        }
        page={
          isTrashView ? (
            <TrashPanel
              docs={trashedDocs ?? []}
              folders={trashedFolders ?? []}
              onRestoreDoc={(docId) => restoreDoc(docId).catch(() => undefined)}
              onRestoreFolder={(folderId) => restoreFolder(folderId).catch(() => undefined)}
              onPurgeDoc={(docId) => {
                const doc = (trashedDocs ?? []).find((entry) => entry.id === docId);
                if (!doc) return;
                setPurgePrompt({ type: "doc", id: docId, title: doc.title });
              }}
              onPurgeFolder={(folderId) => {
                const folder = (trashedFolders ?? []).find((entry) => entry.id === folderId);
                if (!folder) return;
                setPurgePrompt({ type: "folder", id: folderId, title: folder.name });
              }}
            />
          ) : (
            <PagePanel
              doc={displayDoc}
              folders={folders ?? []}
              onTitleChange={(title) => {
                setTitleDraft(title);
                debouncedRename(title);
              }}
              onFolderChange={(folderId) => {
                if (!currentDoc) return;
                moveDoc(currentDoc.id, folderId).catch(() => undefined);
              }}
              onBodyChange={(body) => {
                setBodyDraft(body);
                debouncedSave(body);
              }}
              onOpenLink={openDocByLink}
              onPreviewDoc={setLinkPreviewDocId}
              onCursorLink={handleCursorLink}
              linkOptions={[
                ...(folders ?? []).map((folder) => ({
                  id: folder.id,
                  title: folder.name,
                  body: "",
                  kind: "folder" as const
                })),
                ...(docs ?? [])
                  .filter((doc) => !isIndexDoc(doc))
                  .map((doc) => ({ ...doc, kind: "doc" as const })),
                ...(references ?? []).map((ref) => ({
                  id: ref.id,
                  title: ref.name,
                  body: ref.content,
                  kind: "reference" as const,
                  slug: ref.slug
                }))
              ]}
              mode={pageMode}
              onModeChange={setPageMode}
              isDirty={Boolean(
                currentDoc &&
                  (titleDraft !== currentDoc.title || bodyDraft !== currentDoc.body)
              )}
              lastEdited={currentDoc?.updatedAt ?? null}
              onDeleteDoc={() => {
                if (!currentDoc) return;
                setDocDeletePrompt(currentDoc);
              }}
              onOpenFolder={(folderId) => {
                const folder = (folders ?? []).find((entry) => entry.id === folderId);
                if (!folder) return;
                navigate(`/folder/${encodeURIComponent(folder.name)}`);
              }}
              onOpenHome={() => {
                const welcome = (docs ?? []).find((doc) => doc.title === "Welcome");
                if (welcome) {
                  navigate(`/doc/${welcome.id}`);
                  return;
                }
                navigate("/");
              }}
              npcCreatures={(bestiaryReferences ?? []).map((entry) => ({
                id: entry.id,
                name: entry.name,
                source: entry.source
              }))}
              npcCreatureId={npcProfile?.creatureId ?? null}
              onUpdateNpcCreature={(creatureId) => {
                if (!currentDoc) return;
                setNpcProfile(currentDoc.id, creatureId).catch(() => undefined);
              }}
              showNpcTools={isPeopleDoc}
            />
          )
        }
        marginalia={
          isTrashView ? null : (
            <Marginalia
              backlinks={backlinks ?? []}
              tags={tags ?? []}
              onOpenDoc={openDoc}
              onOpenReference={(slug, id) => navigate(`/reference/${slug}?entry=${id}`)}
              onFilterTag={(type, value) => setTagFilter({ type, value })}
              activeTag={tagFilter}
              filteredDocs={tagResults ?? []}
              onClearFilter={() => setTagFilter(null)}
              linkPreview={linkPreviewDoc ?? null}
              mapPins={mapPins ?? []}
              onOpenMaps={() => navigate("/maps")}
              npcCreature={npcCreature}
              worldbuildAnchors={worldbuildAnchors}
              selectedAnchorIds={selectedAnchorIds}
              onToggleWorldbuildAnchor={toggleWorldbuildAnchor}
              worldbuildTone={worldbuildTone}
              onWorldbuildToneChange={setWorldbuildTone}
              worldbuildResults={worldbuildResults}
              worldbuildLoading={worldbuildLoading}
              onGeneratePlotLines={handleGeneratePlotLines}
              onBuildCity={handleBuildCity}
              onGenerateHooks={handleGenerateHooks}
              onGenerateHighLevelPlot={handleGenerateHighLevelPlot}
              onInsertWorldbuildContent={insertWorldbuildContent}
              onCreateDraftDocs={handleCreateDraftDocs}
              onSendWorldbuild={handleSendWorldbuild}
              aiProvider={aiProvider}
              aiMessages={aiMessages}
              aiInput={aiInput}
              aiSending={aiSending}
              aiError={aiError}
              onAiInputChange={setAiInput}
              onSendAiChat={handleSendAiChat}
              onClearAiChat={handleClearAiChat}
              chatLinkDocs={(docs ?? []).filter((doc) => !isIndexDoc(doc))}
              chatTagOptions={chatTagOptions ?? []}
            />
          )
        }
      />
      <QuickOpen
        docs={quickOpenDocs}
        isOpen={quickOpen}
        onClose={() => setQuickOpen(false)}
        onOpenDoc={openDoc}
      />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreate={handleSubmitCampaign}
      />
      <PromptModal
        isOpen={Boolean(templatePrompt)}
        title="New Page from Template"
        label="Page title"
        placeholder="Name this page"
        confirmLabel="Create"
        onConfirm={async (title) => {
          if (!activeCampaignId || !templatePrompt) return;
          const doc = await createDoc(title, templatePrompt.folderId, activeCampaignId);
          const content = applyTemplateTitle(templatePrompt.template.content, title);
          await saveDocContent(doc.id, content);
          openDoc(doc.id);
          setTemplatePrompt(null);
        }}
        onClose={() => setTemplatePrompt(null)}
      />
      <NpcCreateModal
        isOpen={Boolean(npcPrompt)}
        creatures={(bestiaryReferences ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source
        }))}
        onClose={() => setNpcPrompt(null)}
        onCreate={async (title, creatureId) => {
          if (!activeCampaignId || !npcPrompt) return;
          const doc = await createDoc(title || "Unnamed NPC", npcPrompt.folderId, activeCampaignId);
          const content = applyTemplateTitle(
            npcPrompt.template.content,
            title || doc.title
          );
          await saveDocContent(doc.id, content);
          await setNpcProfile(doc.id, creatureId);
          openDoc(doc.id);
          setNpcPrompt(null);
        }}
      />
      <ConfirmModal
        isOpen={Boolean(linkCreatePrompt)}
        title="Create New Page"
        message={
          linkCreatePrompt
            ? `Create a new page for "${linkCreatePrompt}"?`
            : "Create a new page?"
        }
        confirmLabel="Create"
        onConfirm={async () => {
          if (!activeCampaignId || !linkCreatePrompt) return;
          const doc = await createDoc(linkCreatePrompt, null, activeCampaignId);
          openDoc(doc.id);
          setLinkCreatePrompt(null);
        }}
        onClose={() => setLinkCreatePrompt(null)}
      />
      <ConfirmModal
        isOpen={Boolean(docDeletePrompt)}
        title="Move Page to Trash"
        message={
          docDeletePrompt
            ? `Move "${docDeletePrompt.title}" to Trash?`
            : "Move this page to Trash?"
        }
        confirmLabel="Move to Trash"
        onConfirm={async () => {
          if (!docDeletePrompt) return;
          await trashDoc(docDeletePrompt.id);
          const welcome = await getDocByTitle("Welcome", docDeletePrompt.campaignId);
          if (welcome) {
            navigate(`/doc/${welcome.id}`);
          } else {
            navigate("/");
          }
          setDocDeletePrompt(null);
        }}
        onClose={() => setDocDeletePrompt(null)}
      />
      <ConfirmModal
        isOpen={Boolean(activeDraft)}
        title={activeDraft ? `Create Draft: ${activeDraft.title}` : "Create Draft"}
        message={
          activeDraft
            ? `Create draft "${activeDraft.title}" in ${activeDraft.folderHint}?`
            : "Create this draft?"
        }
        confirmLabel="Create Draft"
        onConfirm={async () => {
          if (!activeDraft || !activeCampaignId) return;
          const folderId = resolveDraftFolderId(activeDraft.folderHint);
          const doc = await createDoc(activeDraft.title, folderId, activeCampaignId);
          const body = buildDraftBody(activeDraft);
          await saveDocContent(doc.id, body);
          setDraftQueue((prev) => {
            if (!prev) return null;
            const nextIndex = prev.index + 1;
            if (nextIndex >= prev.drafts.length) return null;
            return { ...prev, index: nextIndex };
          });
        }}
        onClose={() => setDraftQueue(null)}
      />
      <ConfirmModal
        isOpen={Boolean(purgePrompt)}
        title="Delete Forever"
        message={
          purgePrompt
            ? `Permanently delete "${purgePrompt.title}"? This cannot be undone.`
            : "Permanently delete this item?"
        }
        confirmLabel="Delete Forever"
        onConfirm={async () => {
          if (!purgePrompt) return;
          if (purgePrompt.type === "doc") {
            await purgeDoc(purgePrompt.id);
          } else {
            await purgeFolder(purgePrompt.id);
          }
          setPurgePrompt(null);
        }}
        onClose={() => setPurgePrompt(null)}
      />
    </>
  );
}
