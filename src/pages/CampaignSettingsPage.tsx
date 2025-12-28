import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import CampaignPanel from "../ui/CampaignPanel";
import CampaignModal from "../ui/components/CampaignModal";
import ConfirmModal from "../ui/components/ConfirmModal";
import useSupabaseQuery from "../lib/useSupabaseQuery";
import { formatRelativeTime } from "../lib/text";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthGate";
import {
  archiveCampaign,
  createCampaign,
  createCampaignInvite,
  deleteCampaign,
  deleteCampaignInvite,
  getCampaignById,
  getSetting,
  listCampaignInvites,
  listCampaignMembers,
  listCampaigns,
  listDocs,
  listFolders,
  listSharedSnippets,
  deleteSharedSnippet,
  setDocShared,
  setFolderShared,
  setSetting,
  unarchiveCampaign,
  updateCampaign
} from "../vault/queries";
import { migrateImplicitWorld, seedCampaignIfNeeded } from "../vault/seed";

export default function CampaignSettingsPage() {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    campaignId ?? null
  );
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"dm" | "player">("player");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sent" | "error">(
    "idle"
  );
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [archiveMessage, setArchiveMessage] = useState("");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
  const members = useSupabaseQuery(
    () => (activeCampaignId ? listCampaignMembers(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["campaign_members"] }
  );
  const invites = useSupabaseQuery(
    () => (activeCampaignId ? listCampaignInvites(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["campaign_invites"] }
  );
  const snippets = useSupabaseQuery(
    () => (activeCampaignId ? listSharedSnippets(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["shared_snippets"] }
  );

  const role = useMemo(() => {
    if (!user || !campaign) return null;
    if (campaign.ownerId && campaign.ownerId === user.id) return "dm";
    const member = (members ?? []).find((entry) => entry.userId === user.id);
    return member?.role ?? null;
  }, [campaign, members, user]);

  const displayMembers = useMemo(() => {
    const list = (members ?? []).slice();
    if (campaign?.ownerId) {
      const alreadyListed = list.some((entry) => entry.userId === campaign.ownerId);
      if (!alreadyListed) {
        list.unshift({
          id: -1,
          campaignId: campaign.id,
          userId: campaign.ownerId,
          role: "dm",
          email: campaign.ownerId === user?.id ? user.email : null,
          createdAt: campaign.createdAt
        });
      }
    }
    return list;
  }, [campaign, members, user?.email, user?.id]);

  const sortedDocs = useMemo(
    () => (docs ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    [docs]
  );
  const sortedFolders = useMemo(
    () => (folders ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  useEffect(() => {
    if (!campaignId) return;
    setActiveCampaignId(campaignId);
    setSetting("activeCampaignId", campaignId).catch(() => undefined);
  }, [campaignId]);

  useEffect(() => {
    const ensureCampaign = async () => {
      if (activeCampaignId) {
        await seedCampaignIfNeeded(activeCampaignId);
        await migrateImplicitWorld(activeCampaignId);
        return;
      }
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await seedCampaignIfNeeded(storedCampaignId);
        await migrateImplicitWorld(storedCampaignId);
        navigate(`/campaign/${storedCampaignId}/settings`);
        return;
      }
      const existing = await listCampaigns();
      if (existing.length > 0) {
        const first = existing[0];
        setActiveCampaignId(first.id);
        await setSetting("activeCampaignId", first.id);
        await seedCampaignIfNeeded(first.id);
        await migrateImplicitWorld(first.id);
        navigate(`/campaign/${first.id}/settings`);
        return;
      }
      const created = await createCampaign("Campaign One", "");
      setActiveCampaignId(created.id);
      await setSetting("activeCampaignId", created.id);
      await seedCampaignIfNeeded(created.id);
      await migrateImplicitWorld(created.id);
      navigate(`/campaign/${created.id}/settings`);
    };
    ensureCampaign().catch(() => undefined);
  }, [activeCampaignId, navigate]);

  const switchToAvailableCampaign = async () => {
    const remaining = await listCampaigns();
    if (remaining.length > 0) {
      const next = remaining[0];
      setActiveCampaignId(next.id);
      await setSetting("activeCampaignId", next.id);
      navigate(`/campaign/${next.id}/settings`);
      return;
    }
    navigate("/");
  };

  const handleSendInvite = async () => {
    if (!activeCampaignId || !user) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteStatus("idle");
    try {
      const invite = await createCampaignInvite(activeCampaignId, email, inviteRole, user.id);
      const redirectTo =
        import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? window.location.origin;
      const redirectBase = redirectTo.endsWith("/")
        ? redirectTo.slice(0, -1)
        : redirectTo;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${redirectBase}/invite/${invite.id}`
        }
      });
      setInviteStatus(error ? "error" : "sent");
      if (!error) {
        setInviteEmail("");
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
      setInviteStatus("error");
    }
  };

  const handleArchive = async () => {
    console.debug("[WB] archive click", { activeCampaignId, role });
    if (!activeCampaignId) return;
    if (role !== "dm") {
      setArchiveStatus("error");
      setArchiveMessage("Only the DM can archive campaigns.");
      return;
    }
    setArchiveStatus("idle");
    setArchiveMessage("");
    const error = await archiveCampaign(activeCampaignId);
    console.debug("[WB] archive result", { error });
    if (error) {
      setArchiveStatus("error");
      setArchiveMessage("Could not archive the campaign. Check RLS policies.");
      return;
    }
    setArchiveStatus("success");
    setArchiveMessage("Campaign archived.");
    await switchToAvailableCampaign();
  };

  const handleUnarchive = async () => {
    console.debug("[WB] unarchive click", { activeCampaignId, role });
    if (!activeCampaignId) return;
    if (role !== "dm") {
      setArchiveStatus("error");
      setArchiveMessage("Only the DM can unarchive campaigns.");
      return;
    }
    setArchiveStatus("idle");
    setArchiveMessage("");
    const error = await unarchiveCampaign(activeCampaignId);
    console.debug("[WB] unarchive result", { error });
    if (error) {
      setArchiveStatus("error");
      setArchiveMessage("Could not unarchive the campaign.");
      return;
    }
    setArchiveStatus("success");
    setArchiveMessage("Campaign restored.");
  };

  const handleDelete = async () => {
    console.debug("[WB] delete click", { activeCampaignId, role });
    if (!activeCampaignId) return;
    if (role !== "dm") {
      setArchiveStatus("error");
      setArchiveMessage("Only the DM can delete campaigns.");
      return;
    }
    await deleteCampaign(activeCampaignId);
    console.debug("[WB] delete done");
    await switchToAvailableCampaign();
  };

  if (!activeCampaignId) {
    return (
      <div className="min-h-screen bg-parchment/80 flex items-center justify-center">
        <div className="text-sm font-ui text-ink-soft">Loading campaign…</div>
      </div>
    );
  }

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
          onSelectCampaign={(nextId) => {
            if (!nextId) return;
            navigate(`/campaign/${nextId}/settings`);
          }}
          onCreateCampaign={() => setCampaignModalOpen(true)}
          onOpenSettings={() => navigate("/settings")}
        />
      }
      sidebar={
        <div className="space-y-4">
          <CampaignPanel
            activeCampaign={campaign}
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
            onCreateCampaign={() => setCampaignModalOpen(true)}
            onUpdateCampaign={(campaignIdValue, updates) => {
              updateCampaign(campaignIdValue, updates).catch(() => undefined);
            }}
          />
          <div className="page-panel p-4 space-y-3">
            <div className="font-display text-lg">Player View</div>
            <p className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Preview shared content
            </p>
            <button
              onClick={() => navigate(`/campaign/${activeCampaignId}/player`)}
              className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
            >
              Open Player View
            </button>
          </div>
        </div>
      }
      page={
        <div id="campaign-settings" className="page-panel p-8 space-y-6">
          <div className="chapter-divider pb-4 space-y-2">
            <div className="text-3xl font-display">Campaign Settings</div>
            <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
              Roles, sharing, and campaign lifecycle
            </div>
          </div>

          {role === null && (
            <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6">
              <div className="text-lg font-display">Access limited</div>
              <p className="mt-2 text-ink-soft">
                You are not yet a member of this campaign. Ask the DM to invite you.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Campaign Basics
                </div>
                {campaign?.archivedAt && (
                  <div className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Archived · {formatRelativeTime(campaign.archivedAt)}
                  </div>
                )}
                {archiveStatus !== "idle" && archiveMessage && (
                  <div
                    className={`rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] ${
                      archiveStatus === "error" ? "text-ember" : "text-ink-soft"
                    }`}
                  >
                    {archiveMessage}
                  </div>
                )}
                <input
                  value={campaign?.name ?? ""}
                  onChange={(event) =>
                    campaign && updateCampaign(campaign.id, { name: event.target.value })
                  }
                  disabled={role !== "dm"}
                  className="w-full text-2xl font-display bg-transparent focus:outline-none"
                  placeholder="Campaign name"
                />
                <textarea
                  value={campaign?.synopsis ?? ""}
                  onChange={(event) =>
                    campaign && updateCampaign(campaign.id, { synopsis: event.target.value })
                  }
                  disabled={role !== "dm"}
                  className="w-full min-h-[140px] rounded-xl border border-page-edge bg-parchment/80 p-3 text-sm font-body"
                  placeholder="What do players need to know?"
                />
              </div>

              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Members
                </div>
                {role === "dm" ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr_auto]">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="player@adventure.com"
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      />
                      <select
                        value={inviteRole}
                        onChange={(event) =>
                          setInviteRole(event.target.value as "dm" | "player")
                        }
                        className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                      >
                        <option value="player">Player</option>
                        <option value="dm">DM</option>
                      </select>
                      <button
                        onClick={() => handleSendInvite()}
                        className="rounded-xl border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                      >
                        Send Invite
                      </button>
                    </div>
                    {inviteStatus === "sent" && (
                      <div className="text-xs font-ui text-ink-soft">
                        Magic link sent.
                      </div>
                    )}
                    {inviteStatus === "error" && (
                      <div className="text-xs font-ui text-ember">
                        Could not send invite.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-soft">
                    Only the DM can invite new members.
                  </p>
                )}

                <div className="space-y-2">
                  {displayMembers.length === 0 && (
                    <p className="text-sm text-ink-soft">No members yet.</p>
                  )}
                  {displayMembers.map((member) => (
                    <div
                      key={member.id ?? member.userId}
                      className="flex items-center justify-between rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-body text-ink">
                          {member.email || member.userId}
                        </div>
                        <div className="text-xs text-ink-soft">
                          Joined {formatRelativeTime(member.createdAt)}
                        </div>
                      </div>
                      <span className="rounded-full border border-page-edge px-2 py-1 text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Pending invites
                  </div>
                  {(invites ?? []).length === 0 && (
                    <p className="text-sm text-ink-soft">No pending invites.</p>
                  )}
                  {(invites ?? []).map((invite) => (
                    <div
                      key={invite.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-body text-ink">{invite.email}</div>
                        <div className="text-xs text-ink-soft">
                          Sent {formatRelativeTime(invite.createdAt)} · {invite.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {invite.acceptedAt ? (
                          <span className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                            Accepted
                          </span>
                        ) : (
                          <button
                            onClick={() => deleteCampaignInvite(invite.id)}
                            className="rounded-full border border-page-edge px-3 py-1 text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Shared Pages
                </div>
                {role !== "dm" ? (
                  <p className="text-sm text-ink-soft">
                    Only the DM can adjust sharing.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Shared chapters
                      </div>
                      {sortedFolders.map((folder) => (
                        <label
                          key={folder.id}
                          className="flex items-center justify-between rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm"
                        >
                          <span>{folder.name}</span>
                          <input
                            type="checkbox"
                            checked={folder.shared}
                            onChange={(event) =>
                              setFolderShared(folder.id, event.target.checked)
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-2">
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Shared pages
                      </div>
                      {sortedDocs.map((doc) => (
                        <label
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm"
                        >
                          <span>{doc.title}</span>
                          <input
                            type="checkbox"
                            checked={doc.shared}
                            onChange={(event) => setDocShared(doc.id, event.target.checked)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Clipped Snippets
                </div>
                {(snippets ?? []).length === 0 ? (
                  <p className="text-sm text-ink-soft">No snippets shared yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(snippets ?? []).map((snippet) => {
                      const doc = (docs ?? []).find((entry) => entry.id === snippet.docId);
                      return (
                        <div
                          key={snippet.id}
                          className="rounded-xl border border-page-edge bg-parchment/80 p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                            <span>
                              {doc?.title ?? "Shared snippet"} ·{" "}
                              {formatRelativeTime(snippet.createdAt)}
                            </span>
                            {role === "dm" && snippet.id && (
                              <button
                                onClick={() => deleteSharedSnippet(snippet.id as number)}
                                className="rounded-full border border-page-edge px-2 py-1 text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-ink">
                            {snippet.snippetText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Campaign Lifecycle
                </div>
                {!campaign?.archivedAt && (
                  <button
                    onClick={() => {
                      console.debug("[WB] archive confirm open");
                      setArchiveConfirmOpen(true);
                    }}
                    className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-50"
                  >
                    Archive Campaign
                  </button>
                )}
                {campaign?.archivedAt && (
                  <button
                    onClick={() => handleUnarchive()}
                    className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                  >
                    Unarchive Campaign
                  </button>
                )}
                <button
                  onClick={() => {
                    console.debug("[WB] delete confirm open");
                    setDeleteConfirmOpen(true);
                  }}
                  className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-50"
                >
                  Delete Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreate={(name: string, synopsis: string) => {
          createCampaign(name, synopsis)
            .then((created) => {
              setCampaignModalOpen(false);
              setActiveCampaignId(created.id);
              setSetting("activeCampaignId", created.id).catch(() => undefined);
              navigate(`/campaign/${created.id}/settings`);
            })
            .catch(() => undefined);
        }}
      />
      <ConfirmModal
        isOpen={archiveConfirmOpen}
        title="Archive Campaign"
        message="Archive this campaign? It will be hidden from the campaign list."
        confirmLabel="Archive"
        onConfirm={() => handleArchive()}
        onClose={() => setArchiveConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Campaign"
        message="Delete this campaign and all related data? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => handleDelete()}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
