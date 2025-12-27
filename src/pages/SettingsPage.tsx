import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSupabaseQuery from "../lib/useSupabaseQuery";
import JSZip from "jszip";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import CampaignPanel from "../ui/CampaignPanel";
import CampaignModal from "../ui/components/CampaignModal";
import ConfirmModal from "../ui/components/ConfirmModal";
import {
  createCampaign,
  createDoc,
  createFolder,
  getDocByTitle,
  getSetting,
  listArchivedCampaigns,
  listCampaigns,
  listDocs,
  listEdgesFromDocs,
  listFolders,
  listAllReferences,
  listTagsForDocs,
  setSetting,
  unarchiveCampaign,
  updateAllFolderIndexes,
  updateCampaign,
  saveDocContent
} from "../vault/queries";
import { supabase } from "../lib/supabase";
import { formatRelativeTime } from "../lib/text";
import type { Doc, Edge, Folder, Tag } from "../vault/types";
import { seedCampaignIfNeeded, migrateImplicitWorld } from "../vault/seed";
import { isIndexDoc } from "../vault/indexing";
import {
  buildFoundryExport,
  buildRoll20Export,
  detectImportSource,
  extract5eToolsBestiaryEntries,
  extract5eToolsReferenceEntries,
  extractFoundryEntries,
  extractFoundryReferenceEntries,
  type ImportSource
} from "../lib/importExport";
import { createId } from "../lib/id";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [archiveActionMessage, setArchiveActionMessage] = useState("");
  const [archiveActionStatus, setArchiveActionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [importSource, setImportSource] = useState<ImportSource>("auto");
  const [importFiles, setImportFiles] = useState<FileList | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [importState, setImportState] = useState<{
    active: boolean;
    processed: number;
    total: number;
    label: string;
  }>({
    active: false,
    processed: 0,
    total: 0,
    label: "Preparing import..."
  });
  const [vaultImportFile, setVaultImportFile] = useState<File | null>(null);
  const [vaultImportMode, setVaultImportMode] = useState<"merge" | "overwrite">(
    "merge"
  );
  const [vaultImportConfirmOpen, setVaultImportConfirmOpen] = useState(false);
  const [vaultTransferState, setVaultTransferState] = useState<{
    active: boolean;
    label: string;
  }>({ active: false, label: "" });
  const [aiProvider, setAiProvider] = useState("none");
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("gpt-4o-mini");
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState("https://api.openai.com/v1");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-3-5-sonnet-latest");
  const [googleKey, setGoogleKey] = useState("");
  const [googleModel, setGoogleModel] = useState("gemini-1.5-pro");
  const [mistralKey, setMistralKey] = useState("");
  const [mistralModel, setMistralModel] = useState("mistral-large-latest");
  const [cohereKey, setCohereKey] = useState("");
  const [cohereModel, setCohereModel] = useState("command-r-plus");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.1");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState("");
  const [ollamaDirty, setOllamaDirty] = useState(false);
  const [ollamaSaved, setOllamaSaved] = useState(false);

  const mapFolderRow = (row: any): Folder => ({
    id: row.id,
    name: row.name,
    parentFolderId: row.parent_folder_id ?? null,
    campaignId: row.campaign_id,
    shared: Boolean(row.shared ?? false),
    deletedAt: row.deleted_at ?? null
  });

  const mapDocRow = (row: any): Doc => ({
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


  const campaigns = useSupabaseQuery(() => listCampaigns(), [], [], {
    tables: ["campaigns"]
  });
  const archivedCampaigns = useSupabaseQuery(() => listArchivedCampaigns(), [], [], {
    tables: ["campaigns"]
  });
  const activeCampaign = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
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

  useEffect(() => {
    const ensureCampaign = async () => {
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await seedCampaignIfNeeded(storedCampaignId);
        await migrateImplicitWorld(storedCampaignId);
        return;
      }

      const existing = await listCampaigns();
      if (existing.length > 0) {
        const first = existing[0];
        setActiveCampaignId(first.id);
        await setSetting("activeCampaignId", first.id);
        await seedCampaignIfNeeded(first.id);
        await migrateImplicitWorld(first.id);
        return;
      }

      const campaign = await createCampaign("Campaign One", "");
      setActiveCampaignId(campaign.id);
      await setSetting("activeCampaignId", campaign.id);
      await seedCampaignIfNeeded(campaign.id);
      await migrateImplicitWorld(campaign.id);
    };

    ensureCampaign().catch(() => undefined);
  }, []);

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
    const loadAiSettings = async () => {
      const [
        provider,
        openAiKeySetting,
        openAiModelSetting,
        openAiBaseUrlSetting,
        anthropicKeySetting,
        anthropicModelSetting,
        googleKeySetting,
        googleModelSetting,
        mistralKeySetting,
        mistralModelSetting,
        cohereKeySetting,
        cohereModelSetting,
        ollamaBaseUrlSetting,
        ollamaModelSetting
      ] = await Promise.all([
        getSetting("aiProvider"),
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiAnthropicKey"),
        getSetting("aiAnthropicModel"),
        getSetting("aiGoogleKey"),
        getSetting("aiGoogleModel"),
        getSetting("aiMistralKey"),
        getSetting("aiMistralModel"),
        getSetting("aiCohereKey"),
        getSetting("aiCohereModel"),
        getSetting("aiOllamaBaseUrl"),
        getSetting("aiOllamaModel")
      ]);

      if (provider) setAiProvider(provider);
      if (openAiKeySetting) setOpenAiKey(openAiKeySetting);
      if (openAiModelSetting) setOpenAiModel(openAiModelSetting);
      if (openAiBaseUrlSetting) setOpenAiBaseUrl(openAiBaseUrlSetting);
      if (anthropicKeySetting) setAnthropicKey(anthropicKeySetting);
      if (anthropicModelSetting) setAnthropicModel(anthropicModelSetting);
      if (googleKeySetting) setGoogleKey(googleKeySetting);
      if (googleModelSetting) setGoogleModel(googleModelSetting);
      if (mistralKeySetting) setMistralKey(mistralKeySetting);
      if (mistralModelSetting) setMistralModel(mistralModelSetting);
      if (cohereKeySetting) setCohereKey(cohereKeySetting);
      if (cohereModelSetting) setCohereModel(cohereModelSetting);
      if (ollamaBaseUrlSetting) setOllamaBaseUrl(ollamaBaseUrlSetting);
      if (ollamaModelSetting) setOllamaModel(ollamaModelSetting);
      setOllamaDirty(false);
    };

    loadAiSettings().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("wb:ollamaModels");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setOllamaModels(parsed.filter((entry) => typeof entry === "string"));
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("wb:ollamaModels", JSON.stringify(ollamaModels));
  }, [ollamaModels]);

  const handleFetchOllamaModels = async () => {
    setOllamaLoading(true);
    setOllamaError("");
    try {
      const response = await fetch(`${ollamaBaseUrl.replace(/\/$/, "")}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama responded with ${response.status}`);
      }
      const payload = (await response.json()) as { models?: Array<{ name?: string }> };
      const names = (payload.models ?? [])
        .map((entry) => entry.name)
        .filter((name): name is string => Boolean(name));
      setOllamaModels(names);
      if (names.length === 1) {
        setOllamaModel(names[0]);
        setOllamaDirty(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach Ollama.";
      setOllamaError(message);
    } finally {
      setOllamaLoading(false);
    }
  };

  const handleSaveOllama = async () => {
    await Promise.all([
      setSetting("aiOllamaBaseUrl", ollamaBaseUrl),
      setSetting("aiOllamaModel", ollamaModel)
    ]);
    setOllamaDirty(false);
    setOllamaSaved(true);
    window.setTimeout(() => setOllamaSaved(false), 2000);
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

  const downloadJson = (payload: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  type VaultExport = {
    version: number;
    exportedAt: number;
    campaignId: string;
    folders: Folder[];
    docs: Doc[];
    edges: Edge[];
    tags: Tag[];
  };

  const buildVaultExport = async (): Promise<VaultExport | null> => {
    if (!activeCampaignId) return null;
    const [folderRows, docRows] = await Promise.all([
      supabase.from("folders").select("*").eq("campaign_id", activeCampaignId),
      supabase.from("docs").select("*").eq("campaign_id", activeCampaignId)
    ]);
    if (folderRows.error) console.error("Supabase error in buildVaultExport:folders", folderRows.error);
    if (docRows.error) console.error("Supabase error in buildVaultExport:docs", docRows.error);
    const folders = (folderRows.data ?? []).map(mapFolderRow);
    const docs = (docRows.data ?? []).map(mapDocRow);
    const docIds = docs.map((doc) => doc.id);
    const [edges, tags] = await Promise.all([
      docIds.length > 0 ? listEdgesFromDocs(docIds) : Promise.resolve([]),
      docIds.length > 0 ? listTagsForDocs(docIds) : Promise.resolve([])
    ]);
    return {
      version: 1,
      exportedAt: Date.now(),
      campaignId: activeCampaignId,
      folders,
      docs,
      edges,
      tags
    };
  };

  const isVaultExport = (data: unknown): data is VaultExport => {
    if (!data || typeof data !== "object") return false;
    const record = data as Record<string, unknown>;
    return (
      Array.isArray(record.folders) &&
      Array.isArray(record.docs) &&
      Array.isArray(record.edges) &&
      Array.isArray(record.tags)
    );
  };

  const applyVaultImport = async (payload: VaultExport, mode: "merge" | "overwrite") => {
    if (!activeCampaignId) return;
    setVaultTransferState({ active: true, label: "Importing vault..." });

    const [existingFolderRows, existingDocRows] = await Promise.all([
      supabase.from("folders").select("*").eq("campaign_id", activeCampaignId),
      supabase.from("docs").select("*").eq("campaign_id", activeCampaignId)
    ]);
    if (existingFolderRows.error) {
      console.error("Supabase error in applyVaultImport:folders", existingFolderRows.error);
    }
    if (existingDocRows.error) {
      console.error("Supabase error in applyVaultImport:docs", existingDocRows.error);
    }
    const existingFolders = (existingFolderRows.data ?? []).map(mapFolderRow);
    const existingDocs = (existingDocRows.data ?? []).map(mapDocRow);
    const existingFolderIds = new Set(existingFolders.map((folder) => folder.id));
    const existingDocIds = new Set(existingDocs.map((doc) => doc.id));

    const folderIdMap = new Map<string, string>();
    const docIdMap = new Map<string, string>();

    const pickFolderId = (id: string) => {
      if (mode === "overwrite") return id;
      if (!existingFolderIds.has(id) && !folderIdMap.has(id)) return id;
      const next = createId();
      return next;
    };

    const pickDocId = (id: string) => {
      if (mode === "overwrite") return id;
      if (!existingDocIds.has(id) && !docIdMap.has(id)) return id;
      const next = createId();
      return next;
    };

    payload.folders.forEach((folder) => {
      if (!folderIdMap.has(folder.id)) {
        folderIdMap.set(folder.id, pickFolderId(folder.id));
      }
    });

    const nextFolders = payload.folders.map((folder) => {
      const nextId = folderIdMap.get(folder.id) ?? pickFolderId(folder.id);
      const nextParent = folder.parentFolderId
        ? folderIdMap.get(folder.parentFolderId) ?? null
        : null;
      return {
        ...folder,
        id: nextId,
        campaignId: activeCampaignId,
        parentFolderId: nextParent
      } satisfies Folder;
    });

    payload.docs.forEach((doc) => {
      if (!docIdMap.has(doc.id)) {
        docIdMap.set(doc.id, pickDocId(doc.id));
      }
    });

    const nextDocs = payload.docs.map((doc, index) => {
      const nextId = docIdMap.get(doc.id) ?? pickDocId(doc.id);
      const nextFolderId = doc.folderId ? folderIdMap.get(doc.folderId) ?? null : null;
      return {
        ...doc,
        id: nextId,
        campaignId: activeCampaignId,
        folderId: nextFolderId,
        sortIndex: doc.sortIndex ?? index + 1
      } satisfies Doc;
    });

    const nextEdges = payload.edges
      .map((edge) => ({
        campaignId: activeCampaignId,
        fromDocId: docIdMap.get(edge.fromDocId) ?? edge.fromDocId,
        toDocId: docIdMap.get(edge.toDocId) ?? edge.toDocId,
        linkText: edge.linkText,
        edgeType: edge.edgeType ?? "link",
        weight: edge.weight ?? 1
      }))
      .filter((edge) => edge.fromDocId && edge.toDocId);

    const nextTags = payload.tags
      .map((tag) => ({
        docId: docIdMap.get(tag.docId) ?? tag.docId,
        type: tag.type,
        value: tag.value
      }))
      .filter((tag) => tag.docId);

    const batchInsert = async (table: string, rows: Record<string, unknown>[]) => {
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from(table).insert(slice);
        if (error) {
          console.error(`Supabase error in applyVaultImport:${table}`, error);
        }
      }
    };

    if (mode === "overwrite") {
      const docIds = existingDocs.map((doc) => doc.id);
      if (docIds.length > 0) {
        await supabase.from("edges").delete().in("from_doc_id", docIds);
        await supabase.from("edges").delete().in("to_doc_id", docIds);
        await supabase.from("tags").delete().in("doc_id", docIds);
        await supabase.from("docs").delete().in("id", docIds);
      }
      if (existingFolders.length > 0) {
        await supabase
          .from("folders")
          .delete()
          .in("id", existingFolders.map((folder) => folder.id));
      }
    }

    if (nextFolders.length > 0) {
      await batchInsert(
        "folders",
        nextFolders.map((folder) => ({
          id: folder.id,
          campaign_id: folder.campaignId,
          name: folder.name,
          parent_folder_id: folder.parentFolderId,
          deleted_at: folder.deletedAt ?? null
        }))
      );
    }
    if (nextDocs.length > 0) {
      await batchInsert(
        "docs",
        nextDocs.map((doc) => ({
          id: doc.id,
          campaign_id: doc.campaignId,
          folder_id: doc.folderId,
          title: doc.title,
          body: doc.body ?? "",
          updated_at: doc.updatedAt,
          sort_index: doc.sortIndex ?? null,
          deleted_at: doc.deletedAt ?? null
        }))
      );
    }
    if (nextEdges.length > 0) {
      await batchInsert(
        "edges",
        nextEdges.map((edge) => ({
          campaign_id: edge.campaignId,
          from_doc_id: edge.fromDocId,
          to_doc_id: edge.toDocId,
          link_text: edge.linkText,
          edge_type: edge.edgeType ?? "link",
          weight: edge.weight ?? 1
        }))
      );
    }
    if (nextTags.length > 0) {
      await batchInsert(
        "tags",
        nextTags.map((tag) => ({
          doc_id: tag.docId,
          type: tag.type,
          value: tag.value
        }))
      );
    }

    await updateAllFolderIndexes(activeCampaignId);
    setVaultTransferState({ active: false, label: "Vault import complete." });
  };

  const getOrCreateFolder = async (name: string, parentFolderId: string | null) => {
    if (!activeCampaignId) return null;
    const existing = (await listFolders(activeCampaignId)).find(
      (folder) => folder.name === name && folder.parentFolderId === parentFolderId
    );
    if (existing) return existing;
    return createFolder(name, parentFolderId, activeCampaignId);
  };

  const handleImportFiles = async (files: File[], source: ImportSource) => {
    if (!activeCampaignId) return;
    setImportState({
      active: true,
      processed: 0,
      total: files.length,
      label: "Preparing files..."
    });
    try {
      const existingReferences = await listAllReferences();
      const makeKey = (slug: string, name: string, source: string) =>
        `${slug}::${name.toLowerCase()}::${source.toLowerCase()}`;
      const existingKeys = new Set(
        existingReferences.map((entry) =>
          makeKey(entry.slug, entry.name, entry.source || "")
        )
      );
      const bumpProcessed = () => {
        setImportState((current) => ({
          ...current,
          processed: Math.min(current.processed + 1, current.total)
        }));
      };

      const batchInsertReferences = async (rows: typeof existingReferences) => {
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const slice = rows.slice(i, i + chunkSize);
          const { error } = await supabase.from("references").insert(
            slice.map((entry) => ({
              id: entry.id,
              slug: entry.slug,
              name: entry.name,
              source: entry.source,
              content: entry.content,
              raw_json: entry.rawJson
            }))
          );
          if (error) {
            console.error("Supabase error in handleImportFiles:references", error);
          }
        }
      };

      const ensureWorldFolder = async () => {
        const importsRoot = await getOrCreateFolder("Imports", null);
        return getOrCreateFolder("World", importsRoot?.id ?? null);
      };

      const addWorldEntries = async (entries: { title: string; body: string }[]) => {
        if (entries.length === 0) return;
        const worldFolder = await ensureWorldFolder();
        for (const entry of entries) {
          const doc = await createDoc(entry.title, worldFolder?.id ?? null, activeCampaignId);
          const tagLine = "@source:foundry";
          const body = entry.body ? `${tagLine}\n\n${entry.body}` : tagLine;
          await saveDocContent(doc.id, body);
        }
      };

      const addReferenceEntries = async (
        entries: { name: string; content: string; source: string; slug: string; rawJson?: string }[]
      ) => {
        if (entries.length === 0) return;
        const toAdd = entries
          .filter((entry) => entry.name.trim())
          .map((entry) => ({
            id: createId(),
            slug: entry.slug,
            name: entry.name.trim(),
            source: entry.source,
            content: entry.content,
            rawJson: entry.rawJson
          }))
          .filter((entry) => !existingKeys.has(makeKey(entry.slug, entry.name, entry.source)));
        if (toAdd.length > 0) {
          await batchInsertReferences(toAdd);
          toAdd.forEach((entry) => {
            existingKeys.add(makeKey(entry.slug, entry.name, entry.source));
          });
        }
      };

      const processJsonContent = async (raw: string, forcedSource: ImportSource) => {
        let data: unknown = null;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
        const detected = forcedSource === "auto" ? detectImportSource(data) : forcedSource;
        if (!detected) return;
        const worldEntries = detected === "foundry" ? extractFoundryEntries(data) : [];
        const referenceEntries =
          detected === "foundry" ? extractFoundryReferenceEntries(data) : [];
        const bestiaryEntries =
          detected === "5etools" ? extract5eToolsBestiaryEntries(data) : [];
        const toolEntries =
          detected === "5etools" ? extract5eToolsReferenceEntries(data) : [];
        setImportState((current) => ({
          ...current,
          label:
            detected === "foundry" ? "Importing Foundry data..." : "Importing 5e.tools data..."
        }));
        await addWorldEntries(worldEntries);
        await addReferenceEntries(referenceEntries);
        await addReferenceEntries(
          bestiaryEntries.map((entry) => ({
            name: entry.name,
            content: entry.content,
            source: entry.source,
            slug: "bestiary",
            rawJson: entry.rawJson
          }))
        );
        await addReferenceEntries(toolEntries);
      };

      const processDbContent = async (raw: string) => {
        const records: unknown[] = [];
        raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
            try {
              records.push(JSON.parse(line));
            } catch {
              // Skip malformed lines.
            }
          });
        if (records.length === 0) return;
        await addWorldEntries(extractFoundryEntries(records));
        await addReferenceEntries(extractFoundryReferenceEntries(records));
      };

      const processFile = async (file: File, forcedSource: ImportSource) => {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".db")) {
          await processDbContent(await file.text());
          return;
        }
        await processJsonContent(await file.text(), forcedSource);
      };

      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".zip")) {
          try {
            const zip = await JSZip.loadAsync(file);
            const entries = Object.values(zip.files).filter((entry) => !entry.dir);
            const importable = entries.filter((entry) => {
              const entryName = entry.name.toLowerCase();
              return entryName.endsWith(".db") || entryName.endsWith(".json");
            });
            setImportState((current) => ({
              ...current,
              total: current.total + Math.max(importable.length - 1, 0),
              label: "Unpacking zip archive..."
            }));
            for (const entry of entries) {
              const entryName = entry.name.toLowerCase();
              if (entryName.endsWith(".db")) {
                await processDbContent(await entry.async("string"));
                bumpProcessed();
              } else if (entryName.endsWith(".json")) {
                await processJsonContent(await entry.async("string"), source);
                bumpProcessed();
              }
            }
          } catch {
            // Ignore broken zips.
          }
          continue;
        }
        await processFile(file, source);
        bumpProcessed();
      }

      await updateAllFolderIndexes(activeCampaignId);
      setImportState((current) => ({
        ...current,
        label: "Import complete."
      }));
    } finally {
      setImportState((current) => ({
        ...current,
        active: false
      }));
    }
  };

  const handleExportFoundry = () => {
    if (!activeCampaignId) return;
    const exportDocs = (docs ?? []).filter((doc) => !isIndexDoc(doc));
    downloadJson(buildFoundryExport(exportDocs), "worldbuilder-foundry.json");
  };

  const handleExportRoll20 = () => {
    if (!activeCampaignId) return;
    const exportDocs = (docs ?? []).filter((doc) => !isIndexDoc(doc));
    downloadJson(buildRoll20Export(exportDocs), "worldbuilder-roll20.json");
  };

  const handleExportVault = async () => {
    const payload = await buildVaultExport();
    if (!payload) return;
    downloadJson(payload, "worldbuilder-vault.json");
  };

  const runVaultImport = async (mode: "merge" | "overwrite") => {
    if (!vaultImportFile) return;
    setVaultTransferState({ active: true, label: "Reading vault file..." });
    try {
      const raw = await vaultImportFile.text();
      const data = JSON.parse(raw);
      if (!isVaultExport(data)) {
        setVaultTransferState({ active: false, label: "Invalid vault file." });
        return;
      }
      await applyVaultImport(data, mode);
      setVaultImportFile(null);
      setVaultTransferState({ active: false, label: "Vault import complete." });
    } catch {
      setVaultTransferState({ active: false, label: "Could not read vault file." });
    }
  };

  return (
    <>
      <AppShell
        header={
          <HeaderBar
            docs={docs ?? []}
            onOpenDoc={(docId) => navigate(`/doc/${docId}`)}
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
          <CampaignPanel
            activeCampaign={activeCampaign}
            viewMode="worldview"
            onSelectView={(view) => {
              if (view === "timeline") {
                navigate("/timeline");
              } else if (view === "maps") {
                navigate("/maps");
              } else {
                navigate("/");
              }
            }}
            onCreateCampaign={handleCreateCampaign}
            onUpdateCampaign={(campaignId, updates) => {
              updateCampaign(campaignId, updates).catch(() => undefined);
            }}
            onOpenSettings={(campaignId) => navigate(`/campaign/${campaignId}/settings`)}
          />
        }
        page={
          <div id="settings-page" className="page-panel p-8 space-y-6">
            <div className="chapter-divider pb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-3xl font-display">Settings</div>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                >
                  Back to World
                </button>
              </div>
              <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
                Import, export, and appearance preferences
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Archived Campaigns
                  </div>
                  {(archivedCampaigns ?? []).length === 0 ? (
                    <p className="text-sm text-ink-soft">No archived campaigns.</p>
                  ) : (
                    <div className="space-y-2">
                      {(archivedCampaigns ?? []).map((campaign) => (
                        <div
                          key={campaign.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="font-body text-ink">{campaign.name}</div>
                            <div className="text-xs text-ink-soft">
                              Archived {campaign.archivedAt ? formatRelativeTime(campaign.archivedAt) : "recently"}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              console.debug("[WB] unarchive from settings", {
                                campaignId: campaign.id
                              });
                              setArchiveActionStatus("idle");
                              setArchiveActionMessage("");
                              const error = await unarchiveCampaign(campaign.id);
                              if (error) {
                                setArchiveActionStatus("error");
                                setArchiveActionMessage("Could not unarchive campaign.");
                                return;
                              }
                              setArchiveActionStatus("success");
                              setArchiveActionMessage("Campaign restored.");
                            }}
                            className="rounded-full border border-page-edge px-3 py-1 text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                          >
                            Unarchive
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {archiveActionMessage && (
                    <div
                      className={`rounded-xl border border-page-edge px-3 py-2 text-[10px] font-ui uppercase tracking-[0.18em] ${
                        archiveActionStatus === "error" ? "text-ember" : "text-ink-soft"
                      }`}
                    >
                      {archiveActionMessage}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Import Files
                  </div>
                  <select
                    value={importSource}
                    onChange={(event) => setImportSource(event.target.value as ImportSource)}
                    className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="foundry">Foundry JSON/DB</option>
                    <option value="5etools">5e.tools JSON</option>
                  </select>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".json,.db,.zip,application/json"
                    multiple
                    onChange={(event) => setImportFiles(event.target.files)}
                    className="block w-full text-xs font-ui"
                  />
                  <button
                    onClick={() => {
                      if (!importFiles || importFiles.length === 0) return;
                      handleImportFiles(Array.from(importFiles), importSource).catch(
                        () => undefined
                      );
                      setImportFiles(null);
                      setFileInputKey((key) => key + 1);
                    }}
                    disabled={
                      !importFiles || importFiles.length === 0 || importState.active
                    }
                    className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft enabled:hover:text-ember disabled:opacity-50"
                  >
                    {importState.active ? "Importing..." : "Import Selected Files"}
                  </button>
                  {importState.active && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-ui text-ink-soft">
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-ember/40 border-t-ember animate-spin" />
                        <span>
                          {importState.label} ({importState.processed}/{importState.total || 1})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-parchment/60 overflow-hidden">
                        <div
                          className="h-full bg-ember/70 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (importState.processed / Math.max(importState.total, 1)) * 100
                              )
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="marginal-note">
                    Supports Foundry JSON/DB, 5e.tools JSON, and zip bundles of either.
                  </p>
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Export
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      onClick={handleExportFoundry}
                      className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                    >
                      Export Foundry
                    </button>
                    <button
                      onClick={handleExportRoll20}
                      className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                    >
                      Export Roll20
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Vault Transfer
                  </div>
                  <button
                    onClick={() => handleExportVault().catch(() => undefined)}
                    className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                  >
                    Export Vault JSON
                  </button>
                  <div className="grid gap-2">
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(event) =>
                        setVaultImportFile(event.target.files?.[0] ?? null)
                      }
                      className="block w-full text-xs font-ui"
                    />
                    <select
                      value={vaultImportMode}
                      onChange={(event) =>
                        setVaultImportMode(event.target.value as "merge" | "overwrite")
                      }
                      className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    >
                      <option value="merge">Merge into current vault</option>
                      <option value="overwrite">Overwrite current vault</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!vaultImportFile) return;
                        if (vaultImportMode === "overwrite") {
                          setVaultImportConfirmOpen(true);
                          return;
                        }
                        runVaultImport(vaultImportMode).catch(() => undefined);
                      }}
                      disabled={!vaultImportFile || vaultTransferState.active}
                      className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft enabled:hover:text-ember disabled:opacity-50"
                    >
                      {vaultTransferState.active ? "Importing..." : "Import Vault JSON"}
                    </button>
                    {vaultTransferState.label && (
                      <div className="text-xs font-ui text-ink-soft">
                        {vaultTransferState.label}
                      </div>
                    )}
                  </div>
                  <p className="marginal-note">
                    Vault JSON includes folders, pages, links, tags, and trash state for
                    the active campaign.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Appearance
                  </div>
                  <div className="grid gap-3">
                    <button
                      onClick={() => {
                        setTheme("light");
                        setSetting("theme", "light").catch(() => undefined);
                      }}
                      className={`rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] ${
                        theme === "light"
                          ? "bg-parchment/90 text-ink"
                          : "text-ink-soft hover:text-ember"
                      }`}
                    >
                      Daylight
                    </button>
                    <button
                      onClick={() => {
                        setTheme("dark");
                        setSetting("theme", "dark").catch(() => undefined);
                      }}
                      className={`rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] ${
                        theme === "dark"
                          ? "bg-parchment/90 text-ink"
                          : "text-ink-soft hover:text-ember"
                      }`}
                    >
                      Candlelit
                    </button>
                  </div>
                  <p className="marginal-note">
                    Theme changes apply immediately across the vault.
                  </p>
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    AI Providers (Optional)
                  </div>
                  <div className="grid gap-3">
                    <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                      Provider
                    </label>
                    <select
                      value={aiProvider}
                      onChange={(event) => {
                        const next = event.target.value;
                        setAiProvider(next);
                        setSetting("aiProvider", next).catch(() => undefined);
                      }}
                      className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    >
                      <option value="none">None (local-only)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                      <option value="mistral">Mistral</option>
                      <option value="cohere">Cohere</option>
                      <option value="ollama">Ollama (local)</option>
                    </select>
                  </div>
                  {aiProvider === "openai" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        OpenAI API Key
                      </label>
                      <input
                        value={openAiKey}
                        onChange={(event) => {
                          const next = event.target.value;
                          setOpenAiKey(next);
                          setSetting("aiOpenAiKey", next).catch(() => undefined);
                        }}
                        type="password"
                        placeholder="sk-..."
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        OpenAI Model
                      </label>
                      <input
                        value={openAiModel}
                        onChange={(event) => {
                          const next = event.target.value;
                          setOpenAiModel(next);
                          setSetting("aiOpenAiModel", next).catch(() => undefined);
                        }}
                        placeholder="gpt-4o-mini"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        OpenAI Base URL
                      </label>
                      <input
                        value={openAiBaseUrl}
                        onChange={(event) => {
                          const next = event.target.value;
                          setOpenAiBaseUrl(next);
                          setSetting("aiOpenAiBaseUrl", next).catch(() => undefined);
                        }}
                        placeholder="https://api.openai.com/v1"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                    </div>
                  )}
                  {aiProvider === "anthropic" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Anthropic API Key
                      </label>
                      <input
                        value={anthropicKey}
                        onChange={(event) => {
                          const next = event.target.value;
                          setAnthropicKey(next);
                          setSetting("aiAnthropicKey", next).catch(() => undefined);
                        }}
                        type="password"
                        placeholder="sk-ant-..."
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Anthropic Model
                      </label>
                      <input
                        value={anthropicModel}
                        onChange={(event) => {
                          const next = event.target.value;
                          setAnthropicModel(next);
                          setSetting("aiAnthropicModel", next).catch(() => undefined);
                        }}
                        placeholder="claude-3-5-sonnet-latest"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                    </div>
                  )}
                  {aiProvider === "google" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Google API Key
                      </label>
                      <input
                        value={googleKey}
                        onChange={(event) => {
                          const next = event.target.value;
                          setGoogleKey(next);
                          setSetting("aiGoogleKey", next).catch(() => undefined);
                        }}
                        type="password"
                        placeholder="AIza..."
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Gemini Model
                      </label>
                      <input
                        value={googleModel}
                        onChange={(event) => {
                          const next = event.target.value;
                          setGoogleModel(next);
                          setSetting("aiGoogleModel", next).catch(() => undefined);
                        }}
                        placeholder="gemini-1.5-pro"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                    </div>
                  )}
                  {aiProvider === "mistral" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Mistral API Key
                      </label>
                      <input
                        value={mistralKey}
                        onChange={(event) => {
                          const next = event.target.value;
                          setMistralKey(next);
                          setSetting("aiMistralKey", next).catch(() => undefined);
                        }}
                        type="password"
                        placeholder="mistral-..."
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Mistral Model
                      </label>
                      <input
                        value={mistralModel}
                        onChange={(event) => {
                          const next = event.target.value;
                          setMistralModel(next);
                          setSetting("aiMistralModel", next).catch(() => undefined);
                        }}
                        placeholder="mistral-large-latest"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                    </div>
                  )}
                  {aiProvider === "cohere" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Cohere API Key
                      </label>
                      <input
                        value={cohereKey}
                        onChange={(event) => {
                          const next = event.target.value;
                          setCohereKey(next);
                          setSetting("aiCohereKey", next).catch(() => undefined);
                        }}
                        type="password"
                        placeholder="cohere-..."
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Cohere Model
                      </label>
                      <input
                        value={cohereModel}
                        onChange={(event) => {
                          const next = event.target.value;
                          setCohereModel(next);
                          setSetting("aiCohereModel", next).catch(() => undefined);
                        }}
                        placeholder="command-r-plus"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                    </div>
                  )}
                  {aiProvider === "ollama" && (
                    <div className="grid gap-3">
                      <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Ollama Base URL
                      </label>
                      <input
                        value={ollamaBaseUrl}
                        onChange={(event) => {
                          const next = event.target.value;
                          setOllamaBaseUrl(next);
                          setOllamaDirty(true);
                        }}
                        placeholder="http://localhost:11434"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleFetchOllamaModels().catch(() => undefined)}
                          disabled={ollamaLoading}
                          className="rounded-full border border-page-edge px-3 py-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-60"
                        >
                          {ollamaLoading ? "Loading..." : "List Models"}
                        </button>
                        {ollamaError && (
                          <span className="text-xs font-ui text-ember">{ollamaError}</span>
                        )}
                      </div>
                      {ollamaModels.length > 0 ? (
                        <div className="grid gap-2">
                          <label className="text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                            Ollama Model
                          </label>
                          <select
                            value={ollamaModel}
                            onChange={(event) => {
                              const next = event.target.value;
                              setOllamaModel(next);
                              setOllamaDirty(true);
                            }}
                            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                          >
                            {ollamaModels.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <label className="text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                            Ollama Model
                          </label>
                          <input
                            value={ollamaModel}
                            onChange={(event) => {
                              const next = event.target.value;
                              setOllamaModel(next);
                              setOllamaDirty(true);
                            }}
                            placeholder="llama3.1"
                            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveOllama().catch(() => undefined)}
                          disabled={!ollamaDirty}
                          className="rounded-full border border-page-edge px-3 py-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-60"
                        >
                          Save
                        </button>
                        {ollamaSaved && (
                          <span className="text-xs font-ui text-ink-soft">Saved.</span>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="marginal-note">
                    API keys are stored locally in your browser and never leave your machine
                    unless you connect a provider.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
        marginalia={null}
      />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreate={handleSubmitCampaign}
      />
      <ConfirmModal
        isOpen={vaultImportConfirmOpen}
        title="Overwrite Vault Data"
        message="This will replace the current campaign's vault pages, folders, links, and tags. Continue?"
        confirmLabel="Overwrite"
        onConfirm={() => {
          setVaultImportConfirmOpen(false);
          runVaultImport("overwrite").catch(() => undefined);
        }}
        onClose={() => setVaultImportConfirmOpen(false)}
      />
    </>
  );
}
