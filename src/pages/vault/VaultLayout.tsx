import AppShell from "../../ui/AppShell";
import HeaderBar from "../../ui/HeaderBar";
import CampaignPanel from "../../ui/CampaignPanel";
import Sidebar from "../../ui/Sidebar";
import PagePanel from "../../ui/PagePanel";
import Marginalia, { type Backlink, type MapPin } from "../../ui/Marginalia";
import TrashPanel from "../../ui/TrashPanel";
import AuthoringCommandBar from "../../ui/AuthoringCommandBar";
import type { Asset, Campaign, Doc, Folder, Tag, ReferenceEntry } from "../../vault/types";
import type { WorldbuildAnchor, WorldbuildDraft, WorldbuildResult } from "../../ai/worldbuild";
import type { TemplateOption } from "../../lib/templates";
import type { PrepHelpers } from "../../prep/helpers";
import type { VaultDiagnosticsReport } from "../../features/vaultDiagnostics/buildVaultDiagnostics";

type LinkOption = {
  id: string;
  title: string;
  body: string;
  kind?: "doc" | "reference" | "folder";
  slug?: string;
};

export default function VaultLayout({
  isTrashView,
  docs,
  folders,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onCreateCampaign,
  onOpenSettings,
  onNavigateReference,
  activeCampaign,
  viewMode,
  onSelectView,
  onUpdateCampaign,
  onOpenCampaignSettings,
  onOpenDoc,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderDocs,
  onCreateDoc,
  templates,
  onCreateDocFromTemplate,
  onManageTemplates,
  activeFolderId,
  onOpenTrash,
  trashedCount,
  trashedDocs,
  trashedFolders,
  onRestoreDoc,
  onRestoreFolder,
  onPurgeDoc,
  onPurgeFolder,
  displayDoc,
  pageMode,
  onModeChange,
  isDirty,
  saveStatus,
  lastEdited,
  onTitleChange,
  onTitleCommit,
  onFolderChange,
  onBodyChange,
  onOpenLink,
  onPreviewDoc,
  onCursorLink,
  linkOptions,
  tagOptions,
  assets,
  onUploadAsset,
  onUpdateAsset,
  onReplaceAsset,
  onDeleteAsset,
  renamePreview,
  onConfirmRename,
  onCancelRename,
  onDeleteDoc,
  onOpenFolder,
  onOpenHome,
  onMetaClickSelection,
  onShareSnippet,
  canShareSnippet,
  npcCreatures,
  npcCreatureId,
  onUpdateNpcCreature,
  showNpcTools,
  backlinks,
  tags,
  onOpenReference,
  onFilterTag,
  activeTag,
  filteredDocs,
  onClearFilter,
  linkPreview,
  mapPins,
  diagnosticsReport,
  onOpenMaps,
  npcCreature,
  worldbuildAnchors,
  selectedAnchorIds,
  onToggleWorldbuildAnchor,
  worldbuildTone,
  onWorldbuildToneChange,
  worldbuildResults,
  worldbuildLoading,
  onGeneratePlotLines,
  onBuildCity,
  onGenerateHooks,
  onGenerateHighLevelPlot,
  onBuildPlace,
  onBuildRegion,
  onBuildCountry,
  onBuildTown,
  onBuildVillage,
  onBuildFort,
  onInsertWorldbuildContent,
  onCreateDraftDocs,
  onSendWorldbuild,
  aiProvider,
  aiMessages,
  aiInput,
  aiSending,
  aiError,
  onAiInputChange,
  onSendAiChat,
  onClearAiChat,
  chatLinkDocs,
  chatTagOptions,
  prepHelpers,
  partyConfig,
  onPartyConfigChange,
  bestiaryReferences,
  sinceDate,
  onSinceDateChange
}: {
  isTrashView: boolean;
  docs: Doc[];
  folders: Folder[];
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  onCreateCampaign: () => void;
  onOpenSettings: () => void;
  onNavigateReference: (slug: string) => void;
  activeCampaign: Campaign | null;
  viewMode: "worldview" | "timeline" | "maps";
  onSelectView: (view: "worldview" | "timeline" | "maps") => void;
  onUpdateCampaign: (campaignId: string, updates: Partial<Campaign>) => void;
  onOpenCampaignSettings: (campaignId: string) => void;
  onOpenDoc: (docId: string) => void;
  onCreateFolder: (name: string, parentFolderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onReorderDocs: (folderId: string | null, orderedDocIds: string[]) => void;
  onCreateDoc: (folderId: string | null) => void;
  templates: TemplateOption[];
  onCreateDocFromTemplate: (template: TemplateOption, folderId: string | null) => void;
  onManageTemplates: () => void;
  activeFolderId: string | null;
  onOpenTrash: () => void;
  trashedCount: number;
  trashedDocs: Doc[];
  trashedFolders: Folder[];
  onRestoreDoc: (docId: string) => void;
  onRestoreFolder: (folderId: string) => void;
  onPurgeDoc: (docId: string) => void;
  onPurgeFolder: (folderId: string) => void;
  displayDoc: Doc | null;
  pageMode: "edit" | "preview" | "split";
  onModeChange: (mode: "edit" | "preview" | "split") => void;
  isDirty: boolean;
  saveStatus: "saved" | "unsaved" | "saving" | "error";
  lastEdited: number | null;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  onFolderChange: (folderId: string | null) => void;
  onBodyChange: (body: string) => void;
  onOpenLink: (target: string) => void;
  onPreviewDoc: (docId: string) => void;
  onCursorLink: (target: string | null) => void;
  linkOptions: LinkOption[];
  tagOptions: Array<{ type: string; value: string }>;
  assets: Asset[];
  onUploadAsset: (file: File, altText: string) => Promise<void>;
  onUpdateAsset: (
    asset: Asset,
    updates: { filename?: string; altText?: string | null }
  ) => Promise<void>;
  onReplaceAsset: (asset: Asset, file: File) => Promise<void>;
  onDeleteAsset: (asset: Asset) => Promise<void>;
  renamePreview: {
    docId: string;
    fromTitle: string;
    toTitle: string;
    linkCount: number;
  } | null;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDeleteDoc: () => void;
  onOpenFolder: (folderId: string) => void;
  onOpenHome: () => void;
  onMetaClickSelection: (selection: { text: string; from: number; to: number }) => void;
  onShareSnippet: (snippet: { text: string; startOffset: number; endOffset: number }) => void;
  canShareSnippet: boolean;
  npcCreatures: Array<{ id: string; name: string; source: string }>;
  npcCreatureId: string | null;
  onUpdateNpcCreature: (creatureId: string | null) => void;
  showNpcTools: boolean;
  backlinks: Backlink[];
  tags: Tag[];
  onOpenReference: (slug: string, id: string) => void;
  onFilterTag: (type: string, value: string) => void;
  activeTag: { type: string; value: string } | null;
  filteredDocs: Doc[];
  onClearFilter: () => void;
  linkPreview:
    | { type: "doc"; data: Doc }
    | { type: "reference"; data: { id: string; name: string; content: string; slug: string } }
    | null;
  mapPins: MapPin[];
  diagnosticsReport: VaultDiagnosticsReport;
  onOpenMaps: () => void;
  npcCreature: { name: string; rawJson?: string } | null;
  worldbuildAnchors: WorldbuildAnchor[];
  selectedAnchorIds: string[];
  onToggleWorldbuildAnchor: (id: string) => void;
  worldbuildTone: string;
  onWorldbuildToneChange: (tone: string) => void;
  worldbuildResults: WorldbuildResult[];
  worldbuildLoading: {
    plotLines: boolean;
    cityBuilder: boolean;
    adventureHooks: boolean;
    highLevelPlot: boolean;
    placeBuilder: boolean;
    regionBuilder: boolean;
    countryBuilder: boolean;
    townBuilder: boolean;
    villageBuilder: boolean;
    fortBuilder: boolean;
  };
  onGeneratePlotLines: () => void;
  onBuildCity: () => void;
  onGenerateHooks: () => void;
  onGenerateHighLevelPlot: () => void;
  onBuildPlace: () => void;
  onBuildRegion: () => void;
  onBuildCountry: () => void;
  onBuildTown: () => void;
  onBuildVillage: () => void;
  onBuildFort: () => void;
  onInsertWorldbuildContent: (entry: string) => void;
  onCreateDraftDocs: (drafts: WorldbuildDraft[]) => void;
  onSendWorldbuild: (resultId: string) => void;
  aiProvider: string;
  aiMessages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: number }>;
  aiInput: string;
  aiSending: boolean;
  aiError: string;
  onAiInputChange: (value: string) => void;
  onSendAiChat: () => void;
  onClearAiChat: () => void;
  chatLinkDocs: Doc[];
  chatTagOptions: Array<{ type: string; value: string }>;
  prepHelpers: PrepHelpers | null;
  partyConfig: { size: number; level: number; difficulty: "easy" | "medium" | "hard" | "deadly" };
  onPartyConfigChange: (next: {
    size: number;
    level: number;
    difficulty: "easy" | "medium" | "hard" | "deadly";
  }) => void;
  bestiaryReferences: ReferenceEntry[];
  sinceDate: string;
  onSinceDateChange: (value: string) => void;
}) {
  return (
    <AppShell
      header={
        <HeaderBar
          docs={docs}
          onOpenDoc={onOpenDoc}
          onNavigateReference={onNavigateReference}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={onSelectCampaign}
          onCreateCampaign={onCreateCampaign}
          onOpenSettings={onOpenSettings}
        />
      }
      sidebar={
        <div className="space-y-4">
          <CampaignPanel
            activeCampaign={activeCampaign}
            viewMode={viewMode}
            onSelectView={onSelectView}
            onCreateCampaign={onCreateCampaign}
            onUpdateCampaign={onUpdateCampaign}
            onOpenSettings={onOpenCampaignSettings}
          />
          <Sidebar
            folders={folders}
            docs={docs}
            activeDocId={displayDoc?.id ?? null}
            onOpenDoc={onOpenDoc}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onReorderDocs={onReorderDocs}
            onCreateDoc={onCreateDoc}
            templates={templates}
            onCreateDocFromTemplate={onCreateDocFromTemplate}
            onManageTemplates={onManageTemplates}
            activeFolderId={activeFolderId}
            onOpenTrash={onOpenTrash}
            trashedCount={trashedCount}
          />
        </div>
      }
      page={
        isTrashView ? (
          <TrashPanel
            docs={trashedDocs}
            folders={trashedFolders}
            onRestoreDoc={onRestoreDoc}
            onRestoreFolder={onRestoreFolder}
            onPurgeDoc={onPurgeDoc}
            onPurgeFolder={onPurgeFolder}
          />
        ) : (
          <div className="space-y-4">
            <AuthoringCommandBar
              mode={pageMode}
              onModeChange={onModeChange}
              diagnosticsReport={diagnosticsReport}
              templateCount={templates.length}
              assetCount={assets.length}
              onManageTemplates={onManageTemplates}
              onFocusMedia={() => {
                if (typeof document === "undefined") return;
                document
                  .getElementById("page-media-library")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onFocusDiagnostics={() => {
                if (typeof document === "undefined") return;
                document
                  .getElementById("marginalia-diagnostics")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            <PagePanel
              doc={displayDoc}
              allDocs={docs}
              folders={folders}
              onTitleChange={onTitleChange}
              onTitleCommit={onTitleCommit}
              onFolderChange={onFolderChange}
              onBodyChange={onBodyChange}
              onOpenLink={onOpenLink}
              onPreviewDoc={onPreviewDoc}
              onCursorLink={onCursorLink}
              linkOptions={linkOptions}
              tagOptions={tagOptions}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onUpdateAsset={onUpdateAsset}
              onReplaceAsset={onReplaceAsset}
              onDeleteAsset={onDeleteAsset}
              renamePreview={renamePreview}
              onConfirmRename={onConfirmRename}
              onCancelRename={onCancelRename}
              mode={pageMode}
              onModeChange={onModeChange}
              isDirty={isDirty}
              saveStatus={saveStatus}
              lastEdited={lastEdited}
              onDeleteDoc={onDeleteDoc}
              onOpenFolder={onOpenFolder}
              onOpenHome={onOpenHome}
              onOpenDoc={onOpenDoc}
              onMetaClickSelection={onMetaClickSelection}
              onShareSnippet={onShareSnippet}
              canShareSnippet={canShareSnippet}
              npcCreatures={npcCreatures}
              npcCreatureId={npcCreatureId}
              onUpdateNpcCreature={onUpdateNpcCreature}
              showNpcTools={showNpcTools}
              prepHelpers={prepHelpers}
              partyConfig={partyConfig}
              onPartyConfigChange={onPartyConfigChange}
              bestiaryReferences={bestiaryReferences}
              sinceDate={sinceDate}
              onSinceDateChange={onSinceDateChange}
            />
          </div>
        )
      }
      marginalia={
        isTrashView ? null : (
          <Marginalia
            backlinks={backlinks}
            tags={tags}
            onOpenDoc={onOpenDoc}
            onOpenReference={onOpenReference}
            onFilterTag={onFilterTag}
            activeTag={activeTag}
            filteredDocs={filteredDocs}
            onClearFilter={onClearFilter}
            linkPreview={linkPreview}
            mapPins={mapPins}
            diagnosticsReport={diagnosticsReport}
            onOpenMaps={onOpenMaps}
            npcCreature={npcCreature}
            worldbuildAnchors={worldbuildAnchors}
            selectedAnchorIds={selectedAnchorIds}
            onToggleWorldbuildAnchor={onToggleWorldbuildAnchor}
            worldbuildTone={worldbuildTone}
            onWorldbuildToneChange={onWorldbuildToneChange}
            worldbuildResults={worldbuildResults}
            worldbuildLoading={worldbuildLoading}
            onGeneratePlotLines={onGeneratePlotLines}
            onBuildCity={onBuildCity}
            onGenerateHooks={onGenerateHooks}
            onGenerateHighLevelPlot={onGenerateHighLevelPlot}
            onBuildPlace={onBuildPlace}
            onBuildRegion={onBuildRegion}
            onBuildCountry={onBuildCountry}
            onBuildTown={onBuildTown}
            onBuildVillage={onBuildVillage}
            onBuildFort={onBuildFort}
            onInsertWorldbuildContent={onInsertWorldbuildContent}
            onCreateDraftDocs={onCreateDraftDocs}
            onSendWorldbuild={onSendWorldbuild}
            aiProvider={aiProvider}
            aiMessages={aiMessages}
            aiInput={aiInput}
            aiSending={aiSending}
            aiError={aiError}
            onAiInputChange={onAiInputChange}
            onSendAiChat={onSendAiChat}
            onClearAiChat={onClearAiChat}
            chatLinkDocs={chatLinkDocs}
            chatTagOptions={chatTagOptions}
          />
        )
      }
    />
  );
}
