import { useRef, useState } from "react";
import {
  BoldIcon,
  CommentIcon,
  ItalicIcon,
  StrikethroughIcon,
  LinkIcon,
  QuoteIcon,
  ListUnorderedIcon,
  ListOrderedIcon,
  TasklistIcon,
  ShareIcon,
  TrashIcon
} from "@primer/octicons-react";
import type { Doc, Folder, ReferenceEntry } from "../vault/types";
import Editor, { type EditorHandle } from "./Editor";
import MarkdownPreview from "./MarkdownPreview";
import { formatRelativeTime } from "../lib/text";
import PrepPanel from "./marginalia/PrepPanel";
import type { PrepHelpers } from "../prep/helpers";

export default function PagePanel({
  doc,
  folders,
  onTitleChange,
  onFolderChange,
  onBodyChange,
  onOpenLink,
  onPreviewDoc,
  onCursorLink,
  linkOptions,
  tagOptions,
  mode,
  onModeChange,
  isDirty,
  lastEdited,
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
  prepHelpers,
  partyConfig,
  onPartyConfigChange,
  bestiaryReferences,
  sinceDate,
  onSinceDateChange
}: {
  doc: Doc | null;
  folders: Folder[];
  onTitleChange: (title: string) => void;
  onFolderChange: (folderId: string | null) => void;
  onBodyChange: (body: string) => void;
  onOpenLink: (title: string) => void;
  onPreviewDoc: (docId: string) => void;
  onCursorLink: (target: string | null) => void;
  linkOptions: Array<{
    id: string;
    title: string;
    body: string;
    kind?: "doc" | "reference" | "folder";
    slug?: string;
  }>;
  tagOptions: Array<{ type: string; value: string }>;
  mode: "edit" | "preview";
  onModeChange: (mode: "edit" | "preview") => void;
  isDirty: boolean;
  lastEdited: number | null;
  onDeleteDoc: () => void;
  onOpenFolder: (folderId: string) => void;
  onOpenHome: () => void;
  onMetaClickSelection?: (selection: { text: string; from: number; to: number }) => void;
  onShareSnippet?: (snippet: {
    text: string;
    startOffset: number;
    endOffset: number;
  }) => void;
  canShareSnippet?: boolean;
  npcCreatures?: Array<{ id: string; name: string; source: string }>;
  npcCreatureId?: string | null;
  onUpdateNpcCreature?: (creatureId: string | null) => void;
  showNpcTools?: boolean;
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
  const editorRef = useRef<EditorHandle | null>(null);
  const [npcSelectorOpen, setNpcSelectorOpen] = useState(false);
  const folderMap = new Map<string | null, Folder[]>();
  folders.forEach((folder) => {
    const key = folder.parentFolderId ?? null;
    const list = folderMap.get(key) ?? [];
    list.push(folder);
    folderMap.set(key, list);
  });

  type FolderOption = { folder: Folder; depth: number };

  const flattenFolders = (parentId: string | null, depth: number): FolderOption[] => {
    const children = folderMap.get(parentId) ?? [];
    return children.flatMap((child) => [
      { folder: child, depth },
      ...flattenFolders(child.id, depth + 1)
    ]);
  };

  const folderOptions: FolderOption[] = flattenFolders(null, 0);
  const folderLookup = new Map(folders.map((folder) => [folder.id, folder]));
  const breadcrumbs = [];
  if (doc?.folderId) {
    let currentId: string | null = doc.folderId;
    while (currentId) {
      const folder = folderLookup.get(currentId);
      if (!folder) break;
      breadcrumbs.unshift(folder);
      currentId = folder.parentFolderId;
    }
  }

  if (!doc) {
    return (
      <div className="page-panel p-8 text-center">
        <div className="text-2xl font-display">Open a page</div>
        <p className="mt-2 text-ink-soft">
          Choose a chapter from the index or create a new page to begin.
        </p>
      </div>
    );
  }

  const handleShareSnippet = () => {
    if (!onShareSnippet) return;
    const selection = editorRef.current?.getSelection();
    if (!selection || !selection.text.trim()) return;
    onShareSnippet({
      text: selection.text,
      startOffset: selection.from,
      endOffset: selection.to
    });
  };

  return (
    <div id="page-panel" className="page-panel p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenHome}
            className="hover:text-ember transition"
          >
            World
          </button>
          {breadcrumbs.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onOpenFolder(folder.id)}
              className="hover:text-ember transition"
            >
              / {folder.name}
            </button>
          ))}
          <span className="text-ink">/ {doc.title || "Untitled Page"}</span>
        </div>
        <div className="flex items-center gap-4">
          {isDirty && <span className="text-ember">Unsaved</span>}
          {lastEdited ? (
            <span>Last edited {formatRelativeTime(lastEdited)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 chapter-divider pb-4">
        <div className="flex w-full flex-col gap-1 md:w-auto">
          <label
            htmlFor="page-title"
            className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Page title shown in the sidebar and breadcrumbs."
          >
            Title
          </label>
          <input
            value={doc.title}
            onChange={(event) => onTitleChange(event.target.value)}
            id="page-title"
            placeholder="Untitled Page"
            aria-label="Page title"
            className="w-full md:w-auto text-2xl font-display bg-transparent focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="page-folder-select"
            className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Move this page to a folder."
          >
            Folder
          </label>
          <select
            value={doc.folderId ?? "root"}
            onChange={(event) =>
              onFolderChange(event.target.value === "root" ? null : event.target.value)
            }
            id="page-folder-select"
            className="rounded-full border border-page-edge bg-parchment/80 px-3 py-1 text-sm font-ui"
          >
            <option value="root">Loose Pages</option>
            {folderOptions.map(({ folder, depth }) => {
              const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
              return (
                <option key={folder.id} value={folder.id}>
                  {prefix}
                  {folder.name}
                </option>
              );
            })}
          </select>
          <div
            id="page-mode-toggle"
            className="flex rounded-full border border-page-edge overflow-visible text-xs font-ui uppercase tracking-[0.2em]"
          >
            <button
              onClick={() => onModeChange("edit")}
              className={`px-4 py-2 wb-tooltip ${
                mode === "edit" ? "bg-parchment/80" : "text-ink-soft"
              }`}
              data-tooltip="Edit mode"
            >
              Edit
            </button>
            <button
              onClick={() => onModeChange("preview")}
              className={`px-4 py-2 wb-tooltip ${
                mode === "preview" ? "bg-parchment/80" : "text-ink-soft"
              }`}
              data-tooltip="Preview mode"
            >
              Preview
            </button>
          </div>
          <button
            onClick={onDeleteDoc}
            className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
            data-tooltip="Move page to Trash"
            aria-label="Move page to Trash"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
      {showNpcTools && npcCreatures && onUpdateNpcCreature && (
        <div className="mt-4 rounded-2xl border border-page-edge bg-parchment/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                NPC Base Creature
              </div>
              <div className="text-sm font-display">
                {npcCreatureId
                  ? npcCreatures.find((creature) => creature.id === npcCreatureId)?.name ??
                    "Select a creature"
                  : "Select a creature"}
              </div>
            </div>
            <button
              onClick={() => setNpcSelectorOpen((value) => !value)}
              className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
            >
              {npcSelectorOpen ? "Hide" : "Change"}
            </button>
          </div>
          {npcSelectorOpen && (
            <div className="mt-3 grid gap-2">
              <label
                className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
                data-tooltip="Link an NPC to a creature stat block."
              >
                Base Creature
                <select
                  value={npcCreatureId ?? "none"}
                  onChange={(event) =>
                    onUpdateNpcCreature(event.target.value === "none" ? null : event.target.value)
                  }
                  className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                >
                  <option value="none">No base creature</option>
                  {npcCreatures
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((creature) => (
                      <option key={creature.id} value={creature.id}>
                        {creature.name} · {creature.source}
                      </option>
                    ))}
                </select>
              </label>
              <p className="marginal-note">
                Changing the base creature updates the linked stat block view.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="mt-6 space-y-4">
        {mode === "edit" && (
          <div
            id="page-toolbar"
            className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.2em]"
          >
            <button
              onClick={() => editorRef.current?.wrapSelection("**", "**")}
              data-tooltip="Bold"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Bold"
            >
              <BoldIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.wrapSelection("*", "*")}
              data-tooltip="Italic"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Italic"
            >
              <ItalicIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.wrapSelection("~~", "~~")}
              data-tooltip="Strikethrough"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Strikethrough"
            >
              <StrikethroughIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.openLinkMenu()}
              data-tooltip="Insert link"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Insert link"
            >
              <LinkIcon size={16} />
            </button>
            {onShareSnippet && (canShareSnippet ?? true) && (
              <button
                onClick={handleShareSnippet}
                data-tooltip="Share selection"
                className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
                aria-label="Share selection"
              >
                <ShareIcon size={16} />
              </button>
            )}
            <button
              onClick={() => editorRef.current?.wrapSelection("\"", "\"")}
              data-tooltip="Inline quote"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Inline quote"
            >
              <CommentIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.prefixLines("> ")}
              data-tooltip="Block quote"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Block quote"
            >
              <QuoteIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.prefixLines("- ")}
              data-tooltip="Bulleted list"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Bulleted list"
            >
              <ListUnorderedIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.prefixLines("1. ")}
              data-tooltip="Numbered list"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Numbered list"
            >
              <ListOrderedIcon size={16} />
            </button>
            <button
              onClick={() => editorRef.current?.prefixLines("- [ ] ")}
              data-tooltip="Task list"
              className="rounded-full border border-page-edge p-2 text-ink-soft hover:text-ember wb-tooltip"
              aria-label="Task list"
            >
              <TasklistIcon size={16} />
            </button>
            <PrepPanel
              variant="toolbar"
              prepHelpers={prepHelpers}
              partyConfig={partyConfig}
              onPartyConfigChange={onPartyConfigChange}
              bestiaryReferences={bestiaryReferences}
              since={sinceDate}
              onSinceChange={onSinceDateChange}
            />
          </div>
        )}
        {mode === "edit" ? (
          <div className="space-y-2">
            <div
              className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
              data-tooltip="Markdown content for this page."
            >
              Page Content
            </div>
            <Editor
              ref={editorRef}
              value={doc.body}
              onChange={onBodyChange}
              linkOptions={linkOptions}
              tagOptions={tagOptions}
              onPreviewDoc={onPreviewDoc}
              onCursorLink={onCursorLink}
              onMetaClickSelection={onMetaClickSelection}
            />
          </div>
        ) : (
          <div id="page-preview">
            {doc.body.trim() ? (
              <MarkdownPreview content={doc.body} onOpenLink={onOpenLink} />
            ) : (
              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6 text-center">
                <div className="text-lg font-display">This page is unwritten…</div>
                <p className="mt-2 text-ink-soft">
                  Begin a passage in edit mode to breathe life into it.
                </p>
              </div>
            )}
          </div>
        )}
        {mode === "edit" && !doc.body.trim() && (
          <p className="marginal-note">This page is unwritten…</p>
        )}
      </div>
    </div>
  );
}
