import { useEffect, useState } from "react";
import type { Doc, Folder } from "../vault/types";
import type { TemplateOption } from "../lib/templates";
import { isIndexDoc } from "../vault/indexing";
import { PencilIcon, PlusIcon, TrashIcon } from "@primer/octicons-react";
import PromptModal from "./components/PromptModal";
import ConfirmModal from "./components/ConfirmModal";
import { usePanelCollapse } from "./usePanelCollapse";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";

export default function Sidebar({
  folders,
  docs,
  activeDocId,
  onOpenDoc,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderDocs,
  onCreateDoc,
  templates,
  onCreateDocFromTemplate,
  activeFolderId,
  onOpenTrash,
  trashedCount
}: {
  folders: Folder[];
  docs: Doc[];
  activeDocId: string | null;
  onOpenDoc: (docId: string) => void;
  onCreateFolder: (name: string, parentFolderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onReorderDocs: (folderId: string | null, orderedDocIds: string[]) => void;
  onCreateDoc: (folderId: string | null) => void;
  templates: TemplateOption[];
  onCreateDocFromTemplate: (template: TemplateOption, folderId: string | null) => void;
  activeFolderId: string | null;
  onOpenTrash: () => void;
  trashedCount: number;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const sidebarPanel = usePanelCollapse("sidebar");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    type: "doc" | "folder" | "root";
    id: string | null;
    position?: "above" | "below";
  } | null>(null);
  const [promptState, setPromptState] = useState<{
    title: string;
    label: string;
    placeholder?: string;
    initialValue?: string;
    confirmLabel?: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const actionButtonClass =
    "text-ink-soft hover:text-ember opacity-70 hover:opacity-100 transition";
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
  const docLookup = new Map(docs.map((doc) => [doc.id, doc]));
  const sortDocs = (entries: Doc[]) =>
    entries
      .slice()
      .sort((a, b) => {
        const order = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
        if (order !== 0) return order;
        return a.title.localeCompare(b.title);
      });
  const orderedDocsForFolder = (folderId: string | null) =>
    sortDocs(docMap.get(folderId) ?? []).filter((doc) => !isIndexDoc(doc));

  useEffect(() => {
    if (!openFolderMenuId) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const menu = target.closest(`[data-folder-menu="${openFolderMenuId}"]`);
      if (menu) return;
      setOpenFolderMenuId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openFolderMenuId]);

  const handleDropOnDoc = (targetDoc: Doc, position: "above" | "below") => {
    if (!draggingDocId) return;
    if (draggingDocId === targetDoc.id) return;
    const dragged = docLookup.get(draggingDocId);
    if (!dragged) return;
    const folderId = targetDoc.folderId ?? null;
    const ordered = orderedDocsForFolder(folderId);
    const filtered = ordered.filter((doc) => doc.id !== draggingDocId);
    const targetIndex = filtered.findIndex((doc) => doc.id === targetDoc.id);
    const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
    filtered.splice(insertIndex, 0, { ...dragged, folderId });
    onReorderDocs(folderId, filtered.map((doc) => doc.id));
    setDropTarget(null);
    setDraggingDocId(null);
  };

  const handleDropOnFolder = (folderId: string | null) => {
    if (!draggingDocId) return;
    const dragged = docLookup.get(draggingDocId);
    if (!dragged) return;
    const ordered = orderedDocsForFolder(folderId);
    const filtered = ordered.filter((doc) => doc.id !== draggingDocId);
    filtered.push({ ...dragged, folderId });
    onReorderDocs(folderId, filtered.map((doc) => doc.id));
    setDropTarget(null);
    setDraggingDocId(null);
  };

  const renderFolder = (folder: Folder, depth: number) => {
    const childFolders = folderMap.get(folder.id) ?? [];
    const folderDocs = docMap.get(folder.id) ?? [];
    const indexDocs = folderDocs.filter((doc) => isIndexDoc(doc));
    const normalDocs = orderedDocsForFolder(folder.id);
    const indexDoc = indexDocs.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const isCollapsed = collapsedFolders[folder.id] ?? false;
    const hasChildren = childFolders.length > 0 || normalDocs.length > 0;
    const isDropFolder = dropTarget?.type === "folder" && dropTarget.id === folder.id;

    return (
      <div key={folder.id} className="space-y-2">
        <div
          className={`flex items-center justify-between rounded-xl ${
            isDropFolder ? "drag-sigil" : ""
          }`}
          style={{ paddingLeft: depth * 12 }}
          onDragOver={(event) => {
            event.preventDefault();
            setDropTarget({ type: "folder", id: folder.id });
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDropOnFolder(folder.id);
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setCollapsedFolders((current) => ({
                  ...current,
                  [folder.id]: !isCollapsed
                }))
              }
              className={`rounded-full border border-page-edge p-1 text-ink-soft hover:text-ember ${
                hasChildren ? "opacity-70 hover:opacity-100" : "opacity-30"
              }`}
              aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
              disabled={!hasChildren}
            >
              <span
                className={`block text-xs transition-transform ${
                  isCollapsed ? "-rotate-90" : "rotate-0"
                }`}
              >
                ▾
              </span>
            </button>
          <button
            onClick={() => {
              if (indexDoc) onOpenDoc(indexDoc.id);
            }}
            className={`font-ui text-sm uppercase tracking-[0.18em] text-left wb-tooltip ${
              indexDoc && indexDoc.id === activeDocId
                ? "text-ink underline decoration-ember/70 underline-offset-4"
                : "text-ink-soft hover:text-ember"
            }`}
            data-tooltip={`Open ${folder.name}`}
          >
            {folder.name}
          </button>
          </div>
          <div
            className="relative flex items-center gap-2 text-[11px]"
            data-folder-menu={folder.id}
          >
            <button
              onClick={() => {
                setPromptState({
                  title: "Rename Chapter",
                  label: "Chapter name",
                  initialValue: folder.name,
                  confirmLabel: "Rename",
                  onConfirm: (value) => onRenameFolder(folder.id, value)
                });
              }}
              className={`rounded-full border border-page-edge p-1 ${actionButtonClass} wb-tooltip`}
              data-tooltip={`Rename ${folder.name}`}
            >
              <PencilIcon size={12} />
            </button>
            <button
              onClick={() =>
                setOpenFolderMenuId((current) => (current === folder.id ? null : folder.id))
              }
              className={`rounded-full border border-page-edge p-1 ${actionButtonClass} wb-tooltip`}
              data-tooltip="Create..."
            >
              <PlusIcon size={12} />
            </button>
            <button
              onClick={() => {
                setConfirmState({
                  title: "Move Chapter to Trash",
                  message: `Move "${folder.name}" and its pages to Trash?`,
                  confirmLabel: "Move to Trash",
                  onConfirm: () => onDeleteFolder(folder.id)
                });
              }}
              className={`rounded-full border border-page-edge p-1 ${actionButtonClass} wb-tooltip`}
              data-tooltip={`Delete ${folder.name}`}
            >
              <TrashIcon size={12} />
            </button>
            {openFolderMenuId === folder.id && (
              <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
                <button
                  onClick={() => {
                    setPromptState({
                      title: "New Subchapter",
                      label: "Subchapter name",
                      placeholder: "Subchapter name",
                      confirmLabel: "Create",
                      onConfirm: (value) => onCreateFolder(value, folder.id)
                    });
                    setOpenFolderMenuId(null);
                  }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70"
                >
                  Subchapter
                </button>
                <button
                  onClick={() => {
                    onCreateDoc(folder.id);
                    setOpenFolderMenuId(null);
                  }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70"
                >
                  New Page
                </button>
              </div>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <>
            <div className="space-y-1" style={{ paddingLeft: depth * 12 }}>
              {normalDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onOpenDoc(doc.id)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", doc.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingDocId(doc.id);
                  }}
                  onDragEnd={() => {
                    setDraggingDocId(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position =
                      event.clientY < rect.top + rect.height / 2 ? "above" : "below";
                    setDropTarget({ type: "doc", id: doc.id, position });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropOnDoc(
                      doc,
                      dropTarget?.position === "below" ? "below" : "above"
                    );
                  }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  doc.id === activeDocId
                    ? "bg-parchment/80 text-ink"
                    : "text-ink-soft hover:text-ink"
                } ${
                  draggingDocId === doc.id ? "drag-sigil--active" : ""
                } ${dropTarget?.type === "doc" && dropTarget.id === doc.id ? "drag-sigil" : ""} ${
                  dropTarget?.type === "doc" &&
                  dropTarget.id === doc.id &&
                  dropTarget.position === "above"
                      ? "drag-sigil--edge"
                      : ""
                  } ${
                    dropTarget?.type === "doc" &&
                    dropTarget.id === doc.id &&
                    dropTarget.position === "below"
                      ? "drag-sigil--edge-bottom"
                      : ""
                } wb-tooltip`}
                data-tooltip={`Open ${doc.title}`}
                aria-grabbed={draggingDocId === doc.id}
              >
                {doc.title}
              </button>
            ))}
            </div>
            {childFolders.length > 0 && (
              <div className="space-y-4">
                {childFolders.map((child) => renderFolder(child, depth + 1))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div id="sidebar" className="page-panel p-4">
        <div className="flex items-center justify-between chapter-divider pb-3">
          <div className="font-display text-lg">Index / Chapters</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPromptState({
                  title: "New Chapter",
                  label: "Chapter name",
                  placeholder: "Chapter name",
                  confirmLabel: "Create",
                  onConfirm: (value) => onCreateFolder(value, null)
                });
              }}
              id="sidebar-new-folder"
              className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember wb-tooltip"
              data-tooltip="Create chapter"
            >
              New
            </button>
            <button
              onClick={sidebarPanel.toggle}
              aria-label={sidebarPanel.collapsed ? "Expand panel" : "Minimize panel"}
              className="text-ink-soft hover:text-ember"
            >
              {sidebarPanel.collapsed ? (
                <ChevronDownIcon size={14} />
              ) : (
                <ChevronUpIcon size={14} />
              )}
            </button>
          </div>
        </div>
        {!sidebarPanel.collapsed && (
          <div className="mt-3 space-y-4">
        {templates.length > 0 && (
          <div id="sidebar-templates" className="space-y-2">
            <div className="font-ui text-sm uppercase tracking-[0.18em] text-ink-soft">
              New Page From Template
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                id="template-select"
                className="w-full md:flex-1 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!selectedTemplate) return;
                  onCreateDocFromTemplate(selectedTemplate, activeFolderId);
                }}
                id="template-create"
                className="w-full md:w-auto rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
                data-tooltip={`Create ${selectedTemplate?.label ?? "template"} page`}
              >
                Create
              </button>
            </div>
          </div>
        )}
        <div id="sidebar-folders" className="space-y-4">
          {(folderMap.get(null) ?? []).map((folder) => renderFolder(folder, 0))}
          {(folderMap.get(null) ?? []).length === 0 && (
            <p className="marginal-note">
              No chapters yet. Create one to start organizing your world.
            </p>
          )}
        </div>
        <div
          id="sidebar-loose"
          className={`space-y-2 rounded-xl ${dropTarget?.type === "root" ? "drag-sigil" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDropTarget({ type: "root", id: null });
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDropOnFolder(null);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="font-ui text-sm uppercase tracking-[0.18em] text-ink-soft">Loose Pages</div>
            <button
              onClick={() => onCreateDoc(null)}
              className={`${actionButtonClass} wb-tooltip`}
              data-tooltip="New loose page"
            >
              New Page
            </button>
          </div>
          <div className="space-y-1">
            {orderedDocsForFolder(null).map((doc) => (
              <button
                key={doc.id}
                onClick={() => onOpenDoc(doc.id)}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", doc.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingDocId(doc.id);
                }}
                onDragEnd={() => {
                  setDraggingDocId(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const position =
                    event.clientY < rect.top + rect.height / 2 ? "above" : "below";
                  setDropTarget({ type: "doc", id: doc.id, position });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropOnDoc(
                    doc,
                    dropTarget?.position === "below" ? "below" : "above"
                  );
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  doc.id === activeDocId
                    ? "bg-parchment/80 text-ink"
                    : "text-ink-soft hover:text-ink"
                } ${
                  draggingDocId === doc.id ? "drag-sigil--active" : ""
                } ${dropTarget?.type === "doc" && dropTarget.id === doc.id ? "drag-sigil" : ""} ${
                  dropTarget?.type === "doc" &&
                  dropTarget.id === doc.id &&
                  dropTarget.position === "above"
                    ? "drag-sigil--edge"
                    : ""
                } ${
                  dropTarget?.type === "doc" &&
                  dropTarget.id === doc.id &&
                  dropTarget.position === "below"
                    ? "drag-sigil--edge-bottom"
                    : ""
                } wb-tooltip`}
                data-tooltip={`Open ${doc.title}`}
                aria-grabbed={draggingDocId === doc.id}
              >
                {doc.title}
              </button>
            ))}
            {orderedDocsForFolder(null).length === 0 && (
              <p className="marginal-note">Loose pages will appear here.</p>
            )}
          </div>
        </div>
        <div id="sidebar-trash" className="pt-2">
          <button
            onClick={onOpenTrash}
            className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
            data-tooltip="Open Trash"
          >
            Trash {trashedCount > 0 ? `(${trashedCount})` : ""}
          </button>
        </div>
      </div>
        )}
      </div>
      <PromptModal
      isOpen={Boolean(promptState)}
      title={promptState?.title ?? ""}
      label={promptState?.label ?? ""}
      placeholder={promptState?.placeholder}
      initialValue={promptState?.initialValue}
      confirmLabel={promptState?.confirmLabel}
      onConfirm={(value) => promptState?.onConfirm(value)}
      onClose={() => setPromptState(null)}
      />
      <ConfirmModal
      isOpen={Boolean(confirmState)}
      title={confirmState?.title ?? ""}
      message={confirmState?.message ?? ""}
      confirmLabel={confirmState?.confirmLabel}
      onConfirm={() => confirmState?.onConfirm()}
      onClose={() => setConfirmState(null)}
      />
    </>
  );
}
