import type { Doc, Folder } from "../vault/types";
import { formatRelativeTime } from "../lib/text";

export default function TrashPanel({
  docs,
  folders,
  onRestoreDoc,
  onRestoreFolder,
  onPurgeDoc,
  onPurgeFolder
}: {
  docs: Doc[];
  folders: Folder[];
  onRestoreDoc: (docId: string) => void;
  onRestoreFolder: (folderId: string) => void;
  onPurgeDoc: (docId: string) => void;
  onPurgeFolder: (folderId: string) => void;
}) {
  const sortedDocs = docs
    .slice()
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  const sortedFolders = folders
    .slice()
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  const folderLookup = new Map(folders.map((folder) => [folder.id, folder.name]));

  return (
    <div id="trash-panel" className="page-panel p-8 space-y-6">
      <div className="chapter-divider pb-4 space-y-2">
        <div className="text-3xl font-display">Trash</div>
        <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
          Recently set aside pages and chapters
        </div>
      </div>
      {sortedDocs.length === 0 && sortedFolders.length === 0 && (
        <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6 text-center">
          <div className="text-lg font-display">The shelves are clear.</div>
          <p className="mt-2 text-ink-soft">
            Deleted chapters and pages will linger here until restored or purged.
          </p>
        </div>
      )}
      {sortedFolders.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Trashed Chapters
          </div>
          <div className="space-y-2">
            {sortedFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex flex-col gap-3 rounded-2xl border border-page-edge bg-parchment/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-sm font-display">{folder.name}</div>
                  <div className="marginal-note">
                    Deleted {folder.deletedAt ? formatRelativeTime(folder.deletedAt) : "recently"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em]">
                  <button
                    onClick={() => onRestoreFolder(folder.id)}
                    className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember wb-tooltip"
                    data-tooltip="Restore this chapter"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onPurgeFolder(folder.id)}
                    className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember wb-tooltip"
                    data-tooltip="Permanently delete this chapter"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {sortedDocs.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Trashed Pages
          </div>
          <div className="space-y-2">
            {sortedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 rounded-2xl border border-page-edge bg-parchment/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-sm font-display">{doc.title}</div>
                  <div className="marginal-note">
                    {doc.folderId
                      ? `From ${folderLookup.get(doc.folderId) ?? "a chapter"}`
                      : "Loose page"}
                    {" · "}
                    Deleted {doc.deletedAt ? formatRelativeTime(doc.deletedAt) : "recently"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em]">
                  <button
                    onClick={() => onRestoreDoc(doc.id)}
                    className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember wb-tooltip"
                    data-tooltip="Restore this page"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onPurgeDoc(doc.id)}
                    className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember wb-tooltip"
                    data-tooltip="Permanently delete this page"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
