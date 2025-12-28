import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VaultModals from "./vault/VaultModals";
import VaultLayout from "./vault/VaultLayout";
import {
  createDoc,
  createFolder,
  createSharedSnippet,
  getDocByTitle,
  listDocs,
  listFolders,
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
  setNpcProfile,
  trashDoc,
  trashFolder
} from "../vault/queries";
import { seedReferencesIfNeeded } from "../vault/referenceSeed";
import { isIndexDoc } from "../vault/indexing";
import { templates } from "../lib/templates";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";
import { useHotkeys } from "../lib/useHotkeys";
import type { Doc } from "../vault/types";
import { useAuth } from "../auth/AuthGate";
import type { SelectionPrompt } from "./vault/VaultSelectionModal";
import { applyTemplateTitle, parseLinkedDocId, suggestTitleFromText } from "./vault/utils";
import { buildPrepHelpers } from "../prep/helpers";
import useVaultAiChat from "./vault/useVaultAiChat";
import useVaultWorldbuild from "./vault/useVaultWorldbuild";
import useVaultLinkHandlers from "./vault/useVaultLinkHandlers";
import useVaultCampaigns from "./vault/useVaultCampaigns";
import useVaultData from "./vault/useVaultData";

export default function VaultPage() {
  const { docId, folderName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isTrashView = location.pathname === "/trash";
  const [quickOpen, setQuickOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tagFilter, setTagFilter] = useState<{ type: string; value: string } | null>(null);
  const [viewMode, setViewMode] = useState<"worldview" | "timeline" | "maps">(
    "worldview"
  );
  const [pageMode, setPageMode] = useState<"edit" | "preview">(() => {
    if (typeof window === "undefined") return "edit";
    const stored = window.localStorage.getItem("pageMode");
    return stored === "preview" ? "preview" : "edit";
  });
  const [linkPreviewDocId, setLinkPreviewDocId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [templatePrompt, setTemplatePrompt] = useState<{
    template: typeof templates[number];
    folderId: string | null;
  } | null>(null);
  const [selectionPrompt, setSelectionPrompt] = useState<SelectionPrompt | null>(null);
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

  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const {
    campaigns,
    activeCampaignId,
    activeCampaign,
    selectCampaign,
    createCampaignAndActivate
  } = useVaultCampaigns();
  const {
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
  } = useVaultData({
    activeCampaignId,
    docId,
    tagFilter,
    linkPreviewDocId
  });
  const canShareSnippets = Boolean(activeCampaign?.ownerId && user?.id === activeCampaign.ownerId);
  const npcCreature = useMemo(() => {
    if (!npcProfile?.creatureId) return null;
    const creature = (bestiaryReferences ?? []).find(
      (entry) => entry.id === npcProfile.creatureId
    );
    if (!creature) return null;
    return { name: creature.name, rawJson: creature.rawJson };
  }, [npcProfile?.creatureId, bestiaryReferences]);
  const prepHelpers = useMemo(
    () =>
      buildPrepHelpers({
        context: worldbuildContext ?? null,
        folders: folders ?? [],
        bestiaryReferences: bestiaryReferences ?? []
      }),
    [worldbuildContext, folders, bestiaryReferences]
  );
  const isPeopleDoc = useMemo(() => {
    if (!currentDoc?.folderId) return false;
    const folder = (folders ?? []).find((entry) => entry.id === currentDoc.folderId);
    return folder ? folder.name.toLowerCase().includes("people") : false;
  }, [currentDoc?.folderId, folders]);

  useEffect(() => {
    seedReferencesIfNeeded().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (currentDoc) {
      if (currentDoc.deletedAt) {
        navigate("/trash");
        return;
      }
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
      const folder = (await listFolders(activeCampaignId)).find(
        (candidate) => candidate.name.toLowerCase() === decoded.toLowerCase()
      );
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
      const docs = await listDocs(activeCampaignId);
      const candidates = docs.filter((doc) =>
        doc.title.toLowerCase().includes("folder:")
      );
      const welcomeCandidates = docs.filter((doc) =>
        doc.body.includes("Worldbuilder is a spellbook of systems")
      );
      if (candidates.length === 0 && welcomeCandidates.length === 0) return;
      if (welcomeCandidates.length > 0) {
        const sorted = [...welcomeCandidates].sort((a, b) => b.updatedAt - a.updatedAt);
        const keeper = sorted[0];
        await renameDoc(keeper.id, "Welcome");
        for (const extra of sorted.slice(1)) {
          await purgeDoc(extra.id);
        }
      }
      for (const doc of candidates) {
        if (!doc.body.trim()) {
          await purgeDoc(doc.id);
        }
      }
    };
    cleanupFolderDocs().catch(() => undefined);
  }, [activeCampaignId]);

  const {
    aiProvider,
    aiMessages,
    aiInput,
    aiSending,
    aiError,
    setAiInput,
    handleSendAiChat,
    handleClearAiChat
  } = useVaultAiChat({
    activeCampaignId,
    activeCampaign,
    currentDoc: currentDoc ?? null,
    worldbuildContext
  });

  const {
    worldbuildAnchors,
    worldbuildTone,
    setWorldbuildTone,
    selectedAnchorIds,
    toggleWorldbuildAnchor,
    worldbuildResults,
    worldbuildLoading,
    handleGeneratePlotLines,
    handleBuildCity,
    handleGenerateHooks,
    handleGenerateHighLevelPlot,
    handleBuildPlace,
    handleBuildRegion,
    handleBuildCountry,
    handleBuildTown,
    handleBuildVillage,
    handleBuildFort,
    insertWorldbuildContent,
    handleCreateDraftDocs,
    handleSendWorldbuild,
    activeDraft,
    resolveDraftFolderId,
    buildDraftBody,
    setDraftQueue
  } = useVaultWorldbuild({
    currentDoc: currentDoc ?? null,
    folders: folders ?? [],
    worldbuildContext,
    aiProvider,
    onInsertContent: (content) => {
      if (!currentDoc) return;
      setBodyDraft((prev) => {
        const next = prev.trim() ? `${prev}\n\n${content}` : content;
        debouncedSave(next);
        return next;
      });
    }
  });

  const openDoc = (id: string) => {
    navigate(`/doc/${id}`);
  };

  const { openDocByLink, handleCursorLink } = useVaultLinkHandlers({
    activeCampaignId,
    currentDoc: currentDoc ?? null,
    folders: folders ?? [],
    docs: docs ?? [],
    references: references ?? [],
    onOpenDoc: openDoc,
    onSetLinkCreatePrompt: setLinkCreatePrompt,
    onSetLinkPreviewDocId: setLinkPreviewDocId,
    navigate
  });
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


  return (
    <>
      <VaultLayout
        isTrashView={isTrashView}
        docs={docs ?? []}
        folders={folders ?? []}
        campaigns={campaigns ?? []}
        activeCampaignId={activeCampaignId}
        onSelectCampaign={async (campaignId) => {
          if (!campaignId) return;
          await selectCampaign(campaignId);
          const welcome = await getDocByTitle("Welcome", campaignId);
          if (welcome) {
            navigate(`/doc/${welcome.id}`);
          } else {
            navigate("/");
          }
        }}
        onCreateCampaign={() => setCampaignModalOpen(true)}
        onOpenSettings={() => navigate("/settings")}
        onNavigateReference={(slug) => navigate(`/reference/${slug}`)}
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
        onUpdateCampaign={(campaignId, updates) => {
          updateCampaign(campaignId, updates).catch(() => undefined);
        }}
        onOpenCampaignSettings={(campaignId) => navigate(`/campaign/${campaignId}/settings`)}
        onOpenDoc={openDoc}
        onCreateFolder={(name, parentFolderId) => {
          if (!activeCampaignId) return;
          createFolder(name, parentFolderId, activeCampaignId);
        }}
        onRenameFolder={renameFolder}
        onDeleteFolder={trashFolder}
        onReorderDocs={(folderId, orderedDocIds) => {
          if (!activeCampaignId) return;
          setDocSortOrder(folderId, orderedDocIds).catch(() => undefined);
        }}
        onCreateDoc={handleCreateDoc}
        templates={templates}
        onCreateDocFromTemplate={handleCreateDocFromTemplate}
        activeFolderId={currentDoc?.folderId ?? null}
        onOpenTrash={() => navigate("/trash")}
        trashedCount={(trashedDocs?.length ?? 0) + (trashedFolders?.length ?? 0)}
        trashedDocs={trashedDocs ?? []}
        trashedFolders={trashedFolders ?? []}
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
        displayDoc={displayDoc}
        pageMode={pageMode}
        onModeChange={setPageMode}
        isDirty={Boolean(
          currentDoc && (titleDraft !== currentDoc.title || bodyDraft !== currentDoc.body)
        )}
        lastEdited={currentDoc?.updatedAt ?? null}
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
        tagOptions={chatTagOptions ?? []}
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
        onMetaClickSelection={(selection) => {
          if (!currentDoc) return;
          const title = suggestTitleFromText(selection.text);
          const existingDocId = parseLinkedDocId(selection.text);
          setSelectionPrompt({
            text: selection.text,
            from: selection.from,
            to: selection.to,
            title,
            folderId: currentDoc.folderId ?? null,
            mode: existingDocId ? "link" : "create",
            existingDocId
          });
        }}
        onShareSnippet={({ text, startOffset, endOffset }) => {
          if (!currentDoc || !activeCampaignId || !user) return;
          createSharedSnippet(
            activeCampaignId,
            currentDoc.id,
            text,
            user.id,
            startOffset,
            endOffset
          ).catch(() => undefined);
        }}
        canShareSnippet={canShareSnippets}
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
        backlinks={backlinks ?? []}
        tags={tags ?? []}
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
        onBuildPlace={handleBuildPlace}
        onBuildRegion={handleBuildRegion}
        onBuildCountry={handleBuildCountry}
        onBuildTown={handleBuildTown}
        onBuildVillage={handleBuildVillage}
        onBuildFort={handleBuildFort}
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
        prepHelpers={prepHelpers}
      />
      <VaultModals
        quickOpenDocs={quickOpenDocs}
        quickOpen={quickOpen}
        onCloseQuickOpen={() => setQuickOpen(false)}
        onOpenDoc={openDoc}
        campaignModalOpen={campaignModalOpen}
        onCloseCampaignModal={() => setCampaignModalOpen(false)}
        onCreateCampaign={async (name, synopsis) => {
          const campaign = await createCampaignAndActivate(name, synopsis);
          const welcome = await getDocByTitle("Welcome", campaign.id);
          if (welcome) {
            navigate(`/doc/${welcome.id}`);
          }
        }}
        templatePrompt={templatePrompt}
        onCloseTemplatePrompt={() => setTemplatePrompt(null)}
        onCreateFromTemplate={async (title) => {
          if (!activeCampaignId || !templatePrompt) return;
          const doc = await createDoc(title, templatePrompt.folderId, activeCampaignId);
          const content = applyTemplateTitle(templatePrompt.template.content, title);
          await saveDocContent(doc.id, content);
          openDoc(doc.id);
          setTemplatePrompt(null);
        }}
        npcPrompt={npcPrompt}
        npcCreatures={(bestiaryReferences ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source
        }))}
        onCloseNpcPrompt={() => setNpcPrompt(null)}
        onCreateNpc={async (title, creatureId) => {
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
        linkCreatePrompt={linkCreatePrompt}
        onConfirmLinkCreate={async () => {
          if (!activeCampaignId || !linkCreatePrompt) return;
          const doc = await createDoc(linkCreatePrompt, null, activeCampaignId);
          openDoc(doc.id);
          setLinkCreatePrompt(null);
        }}
        onCloseLinkCreate={() => setLinkCreatePrompt(null)}
        docDeletePrompt={docDeletePrompt}
        onConfirmDeleteDoc={async () => {
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
        onCloseDeleteDoc={() => setDocDeletePrompt(null)}
        activeDraft={activeDraft}
        onConfirmDraft={async () => {
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
        onCloseDraft={() => setDraftQueue(null)}
        purgePrompt={purgePrompt}
        onConfirmPurge={async () => {
          if (!purgePrompt) return;
          if (purgePrompt.type === "doc") {
            await purgeDoc(purgePrompt.id);
          } else {
            await purgeFolder(purgePrompt.id);
          }
          setPurgePrompt(null);
        }}
        onClosePurge={() => setPurgePrompt(null)}
        selectionPrompt={selectionPrompt}
        setSelectionPrompt={setSelectionPrompt}
        docs={docs ?? []}
        folders={folders ?? []}
        bodyDraft={bodyDraft}
        setBodyDraft={setBodyDraft}
        currentDoc={currentDoc ?? null}
        activeCampaignId={activeCampaignId}
        createDoc={createDoc}
        saveDocContent={saveDocContent}
      />
    </>
  );
}
