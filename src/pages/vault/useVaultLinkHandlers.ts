import { useCallback } from "react";
import {
  createDoc,
  getDocById,
  getDocByTitle,
  updateAllFolderIndexes
} from "../../vault/queries";
import type { Doc, Folder, ReferenceEntry } from "../../vault/types";

type UseVaultLinkHandlersInput = {
  activeCampaignId: string | null;
  currentDoc: Doc | null;
  folders: Folder[];
  docs: Doc[];
  references: ReferenceEntry[];
  onOpenDoc: (id: string) => void;
  onSetLinkCreatePrompt: (value: string | null) => void;
  onSetLinkPreviewDocId: (value: string | null) => void;
  navigate: (path: string) => void;
};

export default function useVaultLinkHandlers({
  activeCampaignId,
  currentDoc,
  folders,
  docs,
  references,
  onOpenDoc,
  onSetLinkCreatePrompt,
  onSetLinkPreviewDocId,
  navigate
}: UseVaultLinkHandlersInput) {
  const openDocByLink = useCallback(
    async (target: string) => {
      if (!activeCampaignId) return;
      const normalized = target.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
      if (normalized.startsWith("doc:")) {
        const payload = normalized.slice(4);
        const [id, aliasRaw] = payload.split("|");
        const alias = aliasRaw?.trim();
        if (alias && currentDoc && id === currentDoc.id) {
          const folderMatch =
            folders.find(
              (candidate) => candidate.name.toLowerCase() === alias.toLowerCase()
            ) ?? null;
          if (folderMatch) {
            await updateAllFolderIndexes(activeCampaignId);
            const indexDoc = await getDocByTitle(
              `${folderMatch.name} Index`,
              activeCampaignId
            );
            if (indexDoc) {
              onOpenDoc(indexDoc.id);
              return;
            }
          }
        }
        if (id) {
          onOpenDoc(id);
        }
        return;
      }
      if (normalized.startsWith("folder:")) {
        const folderName = decodeURIComponent(normalized.slice("folder:".length)).trim();
        if (!folderName) return;
        navigate(`/folder/${encodeURIComponent(folderName)}`);
        const folder =
          folders.find(
            (candidate) => candidate.name.toLowerCase() === folderName.toLowerCase()
          ) ?? null;
        if (folder) {
          await updateAllFolderIndexes(activeCampaignId);
          let indexDoc = await getDocByTitle(
            `${folder.name} Index`,
            activeCampaignId
          );
          if (!indexDoc) {
            indexDoc = await createDoc(
              `${folder.name} Index`,
              folder.id,
              activeCampaignId
            );
            await updateAllFolderIndexes(activeCampaignId);
          }
          if (indexDoc) {
            onOpenDoc(indexDoc.id);
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
        onOpenDoc(existing.id);
        return;
      }
      const folder =
        folders.find(
          (candidate) => candidate.name.toLowerCase() === normalized.toLowerCase()
        ) ?? null;
      if (folder) {
        await updateAllFolderIndexes(activeCampaignId);
        const indexDoc = await getDocByTitle(
          `${folder.name} Index`,
          activeCampaignId
        );
        if (indexDoc) {
          onOpenDoc(indexDoc.id);
          return;
        }
      }
      if (!normalized.startsWith("folder:")) {
        onSetLinkCreatePrompt(normalized);
      }
    },
    [
      activeCampaignId,
      currentDoc,
      folders,
      navigate,
      onOpenDoc,
      onSetLinkCreatePrompt
    ]
  );

  const handleCursorLink = useCallback(
    (target: string | null) => {
      if (!target) {
        onSetLinkPreviewDocId(null);
        return;
      }
      const trimmed = target.split("|")[0]?.trim();
      if (!trimmed) {
        onSetLinkPreviewDocId(null);
        return;
      }
      if (trimmed.startsWith("doc:")) {
        onSetLinkPreviewDocId(trimmed.slice(4));
        return;
      }
      if (trimmed.startsWith("ref:")) {
        const parts = trimmed.split(":");
        if (parts.length >= 3) {
          onSetLinkPreviewDocId(parts.slice(2).join(":"));
          return;
        }
      }
      if (trimmed.startsWith("folder:")) {
        const folderName = trimmed.slice("folder:".length).trim();
        const matchingFolder = folders.find(
          (folder) => folder.name.toLowerCase() === folderName.toLowerCase()
        );
        if (matchingFolder) {
          const indexDoc = docs.find(
            (doc) => doc.title === `${matchingFolder.name} Index`
          );
          if (indexDoc) {
            onSetLinkPreviewDocId(indexDoc.id);
            return;
          }
        }
      }
      const matchingDoc = docs.find((doc) => doc.title === trimmed);
      if (matchingDoc) {
        onSetLinkPreviewDocId(matchingDoc.id);
        return;
      }
      const matchingFolder = folders.find(
        (folder) => folder.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (matchingFolder) {
        const indexDoc = docs.find(
          (doc) => doc.title === `${matchingFolder.name} Index`
        );
        if (indexDoc) {
          onSetLinkPreviewDocId(indexDoc.id);
          return;
        }
      }
      const matchingRef = references.find((ref) => ref.name === trimmed);
      if (matchingRef) {
        onSetLinkPreviewDocId(matchingRef.id);
        return;
      }
      onSetLinkPreviewDocId(null);
    },
    [docs, folders, onSetLinkPreviewDocId, references]
  );

  return { openDocByLink, handleCursorLink };
}
