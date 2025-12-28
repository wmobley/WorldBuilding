import Modal from "../../ui/components/Modal";
import type { Doc, Folder } from "../../vault/types";

export type SelectionPrompt = {
  text: string;
  from: number;
  to: number;
  title: string;
  folderId: string | null;
  mode: "create" | "link";
  existingDocId: string | null;
};

export default function VaultSelectionModal({
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
    <Modal
      isOpen={Boolean(selectionPrompt)}
      title="Create Linked Page"
      onClose={() => setSelectionPrompt(null)}
    >
      <div className="space-y-4">
        <p className="marginal-note">
          Link the highlighted text to a page or create a new one.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Link action
          </label>
          <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            <button
              onClick={() =>
                setSelectionPrompt((current) =>
                  current ? { ...current, mode: "create" } : current
                )
              }
              className={`rounded-full border border-page-edge px-3 py-2 ${
                selectionPrompt?.mode === "create"
                  ? "bg-parchment/80 text-ink"
                  : "text-ink-soft hover:text-ember"
              }`}
            >
              Create New Page
            </button>
            <button
              onClick={() =>
                setSelectionPrompt((current) =>
                  current ? { ...current, mode: "link" } : current
                )
              }
              className={`rounded-full border border-page-edge px-3 py-2 ${
                selectionPrompt?.mode === "link"
                  ? "bg-parchment/80 text-ink"
                  : "text-ink-soft hover:text-ember"
              }`}
            >
              Link Existing Page
            </button>
          </div>
        </div>
        {selectionPrompt?.mode === "create" ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                Suggested title
              </label>
              <input
                value={selectionPrompt?.title ?? ""}
                onChange={(event) =>
                  setSelectionPrompt((current) =>
                    current ? { ...current, title: event.target.value } : current
                  )
                }
                className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                Destination folder
              </label>
              <select
                value={selectionPrompt?.folderId ?? "root"}
                onChange={(event) =>
                  setSelectionPrompt((current) =>
                    current
                      ? {
                          ...current,
                          folderId:
                            event.target.value === "root"
                              ? null
                              : event.target.value
                        }
                      : current
                  )
                }
                className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
              >
                <option value="root">Loose Pages</option>
                {folders
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Select page
            </label>
            <select
              value={selectionPrompt?.existingDocId ?? "none"}
              onChange={(event) =>
                setSelectionPrompt((current) =>
                  current
                    ? {
                        ...current,
                        existingDocId:
                          event.target.value === "none" ? null : event.target.value
                      }
                    : current
                )
              }
              className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
            >
              <option value="none">Select a page…</option>
              {docs
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Selected text
          </label>
          <div className="rounded-xl border border-page-edge bg-parchment/70 px-3 py-2 text-sm text-ink">
            {selectionPrompt?.text}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            onClick={() => setSelectionPrompt(null)}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!selectionPrompt || !activeCampaignId) return;
              if (selectionPrompt.mode === "create") {
                const trimmedTitle = selectionPrompt.title.trim() || "New Page";
                const newDoc = await createDoc(
                  trimmedTitle,
                  selectionPrompt.folderId ?? null,
                  activeCampaignId
                );
                if (currentDoc) {
                  const backlink = `> Linked from [[doc:${currentDoc.id}|${currentDoc.title}]]\n\n`;
                  const initialBody = `${backlink}${selectionPrompt.text.trim()}\n`;
                  await saveDocContent(newDoc.id, initialBody);
                  const linkText = ` [[doc:${newDoc.id}|${trimmedTitle}]]`;
                  const before = bodyDraft.slice(0, selectionPrompt.to);
                  const after = bodyDraft.slice(selectionPrompt.to);
                  setBodyDraft(`${before}${linkText}${after}`);
                }
              } else if (selectionPrompt.existingDocId) {
                const doc = docs.find((entry) => entry.id === selectionPrompt.existingDocId);
                const label = doc?.title ?? "Linked Page";
                const linkText = ` [[doc:${selectionPrompt.existingDocId}|${label}]]`;
                const before = bodyDraft.slice(0, selectionPrompt.to);
                const after = bodyDraft.slice(selectionPrompt.to);
                setBodyDraft(`${before}${linkText}${after}`);
              }
              setSelectionPrompt(null);
            }}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
          >
            {selectionPrompt?.mode === "create" ? "Create Page" : "Link Page"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
