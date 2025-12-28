import type { Doc, Folder } from "../../vault/types";
import type { WorldbuildDraft } from "../../ai/worldbuild";
import type { TemplateOption } from "../../lib/templates";
import QuickOpen from "../../ui/QuickOpen";
import CampaignModal from "../../ui/components/CampaignModal";
import PromptModal from "../../ui/components/PromptModal";
import ConfirmModal from "../../ui/components/ConfirmModal";
import NpcCreateModal from "../../ui/components/NpcCreateModal";
import VaultSelectionModal, { type SelectionPrompt } from "./VaultSelectionModal";

export default function VaultModals({
  quickOpenDocs,
  quickOpen,
  onCloseQuickOpen,
  onOpenDoc,
  campaignModalOpen,
  onCloseCampaignModal,
  onCreateCampaign,
  templatePrompt,
  onCloseTemplatePrompt,
  onCreateFromTemplate,
  npcPrompt,
  npcCreatures,
  onCloseNpcPrompt,
  onCreateNpc,
  linkCreatePrompt,
  onConfirmLinkCreate,
  onCloseLinkCreate,
  docDeletePrompt,
  onConfirmDeleteDoc,
  onCloseDeleteDoc,
  activeDraft,
  onConfirmDraft,
  onCloseDraft,
  purgePrompt,
  onConfirmPurge,
  onClosePurge,
  selectionPrompt,
  setSelectionPrompt,
  docs,
  folders,
  bodyDraft,
  setBodyDraft,
  currentDoc,
  activeCampaignId,
  createDoc,
  saveDocContent
}: {
  quickOpenDocs: Doc[];
  quickOpen: boolean;
  onCloseQuickOpen: () => void;
  onOpenDoc: (docId: string) => void;
  campaignModalOpen: boolean;
  onCloseCampaignModal: () => void;
  onCreateCampaign: (name: string, synopsis: string) => void;
  templatePrompt: { template: TemplateOption; folderId: string | null } | null;
  onCloseTemplatePrompt: () => void;
  onCreateFromTemplate: (title: string) => Promise<void> | void;
  npcPrompt: { template: TemplateOption; folderId: string | null } | null;
  npcCreatures: Array<{ id: string; name: string; source: string }>;
  onCloseNpcPrompt: () => void;
  onCreateNpc: (title: string, creatureId: string | null) => Promise<void> | void;
  linkCreatePrompt: string | null;
  onConfirmLinkCreate: () => Promise<void> | void;
  onCloseLinkCreate: () => void;
  docDeletePrompt: Doc | null;
  onConfirmDeleteDoc: () => Promise<void> | void;
  onCloseDeleteDoc: () => void;
  activeDraft: WorldbuildDraft | null;
  onConfirmDraft: () => Promise<void> | void;
  onCloseDraft: () => void;
  purgePrompt: { type: "doc" | "folder"; id: string; title: string } | null;
  onConfirmPurge: () => Promise<void> | void;
  onClosePurge: () => void;
  selectionPrompt: SelectionPrompt | null;
  setSelectionPrompt: React.Dispatch<React.SetStateAction<SelectionPrompt | null>>;
  docs: Doc[];
  folders: Folder[];
  bodyDraft: string;
  setBodyDraft: (next: string) => void;
  currentDoc: Doc | null;
  activeCampaignId: string | null;
  createDoc: (title: string, folderId: string | null, campaignId: string) => Promise<Doc>;
  saveDocContent: (docId: string, body: string) => Promise<void>;
}) {
  return (
    <>
      <QuickOpen
        docs={quickOpenDocs}
        isOpen={quickOpen}
        onClose={onCloseQuickOpen}
        onOpenDoc={onOpenDoc}
      />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={onCloseCampaignModal}
        onCreate={onCreateCampaign}
      />
      <PromptModal
        isOpen={Boolean(templatePrompt)}
        title="New Page from Template"
        label="Page title"
        placeholder="Name this page"
        confirmLabel="Create"
        onConfirm={onCreateFromTemplate}
        onClose={onCloseTemplatePrompt}
      />
      <NpcCreateModal
        isOpen={Boolean(npcPrompt)}
        creatures={npcCreatures}
        onClose={onCloseNpcPrompt}
        onCreate={onCreateNpc}
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
        onConfirm={onConfirmLinkCreate}
        onClose={onCloseLinkCreate}
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
        onConfirm={onConfirmDeleteDoc}
        onClose={onCloseDeleteDoc}
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
        onConfirm={onConfirmDraft}
        onClose={onCloseDraft}
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
        onConfirm={onConfirmPurge}
        onClose={onClosePurge}
      />
      <VaultSelectionModal
        selectionPrompt={selectionPrompt}
        setSelectionPrompt={setSelectionPrompt}
        docs={docs}
        folders={folders}
        bodyDraft={bodyDraft}
        setBodyDraft={setBodyDraft}
        currentDoc={currentDoc}
        activeCampaignId={activeCampaignId}
        createDoc={createDoc}
        saveDocContent={saveDocContent}
      />
    </>
  );
}
