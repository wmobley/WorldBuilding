import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSupabaseQuery from "../lib/useSupabaseQuery";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import CampaignPanel from "../ui/CampaignPanel";
import CampaignModal from "../ui/components/CampaignModal";
import {
  createCampaign,
  getDocByTitle,
  getSetting,
  listCampaigns,
  listDocs,
  setSetting,
  updateCampaign
} from "../vault/queries";
import { seedCampaignIfNeeded } from "../vault/seed";
import { migrateImplicitWorld } from "../vault/seed";
import { buildTimelineEntries } from "../lib/timeline";

export default function TimelinePage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "timeline" | "plot" | "subplot">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const campaigns = useSupabaseQuery(() => listCampaigns(), [], [], {
    tables: ["campaigns"]
  });
  const activeCampaign = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );

  const docs = useSupabaseQuery(
    async () => {
      if (!activeCampaignId) return [];
      const list = await listDocs(activeCampaignId);
      return list.sort((a, b) => a.updatedAt - b.updatedAt);
    },
    [activeCampaignId],
    [],
    { tables: ["docs"] }
  );

  const entries = useMemo(() => buildTimelineEntries(docs ?? []), [docs]);

  const availableTags = useMemo(() => {
    const values = new Set<string>();
    entries.forEach((entry) => {
      if (typeFilter === "all" || entry.tagType === typeFilter) {
        values.add(entry.tagValue);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [entries, typeFilter]);

  const filteredEntries = useMemo(() => {
    const lower = query.toLowerCase();
    return entries
      .filter((entry) => (typeFilter === "all" ? true : entry.tagType === typeFilter))
      .filter((entry) => (tagFilter === "all" ? true : entry.tagValue === tagFilter))
      .filter((entry) => {
        if (!lower) return true;
        return (
          entry.docTitle.toLowerCase().includes(lower) ||
          entry.heading.toLowerCase().includes(lower) ||
          entry.line.toLowerCase().includes(lower)
        );
      })
      .sort((a, b) => {
        const aTime = a.timeKey ?? Number.POSITIVE_INFINITY;
        const bTime = b.timeKey ?? Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return a.docTitle.localeCompare(b.docTitle) || a.lineIndex - b.lineIndex;
      });
  }, [entries, typeFilter, tagFilter, query]);

  const handleCreateCampaign = () => {
    setCampaignModalOpen(true);
  };

  const handleSubmitCampaign = async (name: string, synopsis: string) => {
    const campaign = await createCampaign(name, synopsis);
    setActiveCampaignId(campaign.id);
    await setSetting("activeCampaignId", campaign.id);
    await seedCampaignIfNeeded(campaign.id);
    await migrateImplicitWorld(campaign.id);
    const welcome = await getDocByTitle("Welcome", campaign.id);
    if (welcome) {
      navigate(`/doc/${welcome.id}`);
    }
  };

  useEffect(() => {
    const ensureCampaign = async () => {
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await seedCampaignIfNeeded(storedCampaignId);
        await migrateImplicitWorld(storedCampaignId);
        return;
      }

      const existing = await listCampaigns();
      if (existing.length > 0) {
        const first = existing[0];
        setActiveCampaignId(first.id);
        await setSetting("activeCampaignId", first.id);
        await seedCampaignIfNeeded(first.id);
        await migrateImplicitWorld(first.id);
        return;
      }

      const campaign = await createCampaign("Campaign One", "");
      setActiveCampaignId(campaign.id);
      await setSetting("activeCampaignId", campaign.id);
      await seedCampaignIfNeeded(campaign.id);
      await migrateImplicitWorld(campaign.id);
    };

    ensureCampaign().catch(() => undefined);
  }, []);

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
          onSelectCampaign={async (campaignId) => {
            if (!campaignId) return;
            setActiveCampaignId(campaignId);
            setSetting("activeCampaignId", campaignId).catch(() => undefined);
            const welcome = await getDocByTitle("Welcome", campaignId);
            if (welcome) {
              navigate(`/doc/${welcome.id}`);
            } else {
              navigate("/");
            }
          }}
          onCreateCampaign={handleCreateCampaign}
          onOpenSettings={() => navigate("/settings")}
        />
      }
      sidebar={
        <CampaignPanel
          activeCampaign={activeCampaign}
          viewMode="timeline"
          onSelectView={(view) => {
            if (view === "worldview") {
              navigate("/");
            } else if (view === "maps") {
              navigate("/maps");
            }
          }}
          onCreateCampaign={handleCreateCampaign}
          onUpdateCampaign={(campaignId, updates) => {
            if (!campaignId) return;
            updateCampaign(campaignId, updates).catch(() => undefined);
          }}
          onOpenSettings={(campaignId) => navigate(`/campaign/${campaignId}/settings`)}
        />
      }
      page={
        <div id="timeline-page" className="page-panel p-8 space-y-6">
          <div className="chapter-divider pb-4 space-y-2">
            <div className="text-3xl font-display">Timeline</div>
            <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
              Plotlines and subplots drawn from tagged world notes
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as "all" | "timeline" | "plot" | "subplot")
              }
              className="min-w-0 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
            >
              <option value="all">All threads</option>
              <option value="timeline">Timeline</option>
              <option value="plot">Plotline</option>
              <option value="subplot">Subplot</option>
            </select>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="min-w-0 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
            >
              <option value="all">All tags</option>
              {availableTags.map((value) => (
                <option key={value} value={value}>
                  #{value}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, headings, or page titles..."
              className="min-w-0 rounded-xl border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-ui"
            />
          </div>
          <div className="space-y-3">
            {filteredEntries.length === 0 && (
              <p className="marginal-note">
                Add tags like @timeline:age-of-ash, @plot:main-arc, or @subplot:royal-feud to your
                pages to surface them here.
              </p>
            )}
            {filteredEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => navigate(`/doc/${entry.docId}`)}
                className="timeline-card block w-full text-left rounded-3xl border border-page-edge bg-parchment/70 px-8 py-6 hover:border-ember"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between min-w-0">
                  <div className="min-w-0 font-display text-xl break-words">
                    {entry.heading}
                  </div>
                  <div className="min-w-0 text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft break-words">
                    {entry.docTitle}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  {entry.timeTag && <span>{entry.timeTag}</span>}
                  <span>@{entry.tagType}:{entry.tagValue}</span>
                </div>
                {entry.line && (
                  <div className="marginal-note mt-3 text-base break-words">{entry.line}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      }
      marginalia={null}
      />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreate={handleSubmitCampaign}
      />
    </>
  );
}
