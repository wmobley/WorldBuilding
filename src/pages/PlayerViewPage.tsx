import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import MarkdownPreview from "../ui/MarkdownPreview";
import useSupabaseQuery from "../lib/useSupabaseQuery";
import { formatRelativeTime } from "../lib/text";
import {
  getCampaignById,
  listCampaigns,
  listDocs,
  listFolders,
  listSharedSnippets
} from "../vault/queries";

export default function PlayerViewPage() {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    campaignId ?? null
  );
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const campaigns = useSupabaseQuery(() => listCampaigns(), [], [], {
    tables: ["campaigns"]
  });
  const campaign = useSupabaseQuery(
    () => (activeCampaignId ? getCampaignById(activeCampaignId) : Promise.resolve(null)),
    [activeCampaignId],
    null,
    { tables: ["campaigns"] }
  );
  const docs = useSupabaseQuery(
    () => (activeCampaignId ? listDocs(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["docs"] }
  );
  const folders = useSupabaseQuery(
    () => (activeCampaignId ? listFolders(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["folders"] }
  );
  const snippets = useSupabaseQuery(
    () => (activeCampaignId ? listSharedSnippets(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["shared_snippets"] }
  );

  const docMap = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc])),
    [docs]
  );

  const sortedDocs = useMemo(
    () => (docs ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    [docs]
  );

  const groupedDocs = useMemo(() => {
    const map = new Map<string, typeof sortedDocs>();
    const folderLookup = new Map((folders ?? []).map((folder) => [folder.id, folder]));
    sortedDocs.forEach((doc) => {
      const folderName = doc.folderId
        ? folderLookup.get(doc.folderId)?.name ?? "Loose Pages"
        : "Loose Pages";
      const list = map.get(folderName) ?? [];
      list.push(doc);
      map.set(folderName, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [folders, sortedDocs]);

  const handleOpenLink = (target: string) => {
    if (!target) return;
    if (target.startsWith("doc:")) {
      const idPart = target.slice(4).split("|")[0];
      if (idPart) setSelectedDocId(idPart);
      return;
    }
    if (target.startsWith("ref:")) {
      const payload = target.slice(4);
      const [slug, entryId] = payload.split(":");
      navigate(`/reference/${slug}?entry=${entryId}`);
      return;
    }
    if (target.startsWith("folder:")) {
      return;
    }
    const match = sortedDocs.find(
      (doc) => doc.title.toLowerCase() === target.toLowerCase()
    );
    if (match) setSelectedDocId(match.id);
  };

  const selectedDoc = useMemo(() => {
    if (!selectedDocId && sortedDocs.length > 0) return sortedDocs[0];
    return selectedDocId ? docMap.get(selectedDocId) ?? null : null;
  }, [docMap, selectedDocId, sortedDocs]);

  useEffect(() => {
    if (!campaignId) return;
    setActiveCampaignId(campaignId);
  }, [campaignId]);

  useEffect(() => {
    if (!selectedDocId && sortedDocs.length > 0) {
      setSelectedDocId(sortedDocs[0].id);
    }
  }, [selectedDocId, sortedDocs]);

  return (
    <AppShell
      header={
        <HeaderBar
          docs={docs ?? []}
          onOpenDoc={(docId) => setSelectedDocId(docId)}
          onNavigateReference={(slug) => navigate(`/reference/${slug}`)}
          campaigns={campaigns ?? []}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={(nextId) => {
            if (!nextId) return;
            navigate(`/campaign/${nextId}/player`);
          }}
          onCreateCampaign={() => navigate("/")}
          onOpenSettings={() => navigate("/settings")}
        />
      }
      sidebar={
        <div className="space-y-4">
          <div className="page-panel p-4 space-y-3">
            <div className="font-display text-lg">Shared Pages</div>
            <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              {campaign?.name ?? "Campaign"}
            </div>
            <div className="space-y-3">
              {groupedDocs.map(([folderName, folderDocs]) => (
                <div key={folderName} className="space-y-2">
                  <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                    {folderName}
                  </div>
                  {folderDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`block w-full rounded-lg px-2 py-1 text-left text-sm transition ${
                        doc.id === selectedDoc?.id
                          ? "bg-parchment/80 text-ink"
                          : "text-ink-soft hover:text-ember"
                      }`}
                    >
                      {doc.title || "Untitled"}
                    </button>
                  ))}
                </div>
              ))}
              {sortedDocs.length === 0 && (
                <p className="text-sm text-ink-soft">No shared pages yet.</p>
              )}
            </div>
          </div>
          <div className="page-panel p-4 space-y-3">
            <div className="font-display text-lg">Snippets</div>
            <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Clipped highlights
            </div>
            <div className="space-y-3">
              {(snippets ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">No snippets shared yet.</p>
              ) : (
                (snippets ?? []).map((snippet) => {
                  const doc = docMap.get(snippet.docId);
                  return (
                    <div
                      key={snippet.id}
                      className="rounded-xl border border-page-edge bg-parchment/80 p-3 text-sm"
                    >
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        {doc?.title ?? "Shared snippet"} · {formatRelativeTime(snippet.createdAt)}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-ink">
                        {snippet.snippetText}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      }
      page={
        <div id="player-view" className="page-panel p-8 space-y-6">
          <div className="chapter-divider pb-4 space-y-2">
            <div className="text-3xl font-display">Player View</div>
            <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
              Shared lore and DM highlights
            </div>
          </div>
          {selectedDoc ? (
            <div className="space-y-4">
              <div className="text-2xl font-display">{selectedDoc.title}</div>
              <MarkdownPreview content={selectedDoc.body} onOpenLink={handleOpenLink} />
            </div>
          ) : (
            <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6 text-center">
              <div className="text-lg font-display">No shared pages yet</div>
              <p className="mt-2 text-ink-soft">
                Ask your DM to share a page or snippet.
              </p>
            </div>
          )}
        </div>
      }
    />
  );
}
