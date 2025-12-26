import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import CampaignPanel from "../ui/CampaignPanel";
import CampaignModal from "../ui/components/CampaignModal";
import { db } from "../vault/db";
import {
  createCampaign,
  createMap,
  createMapLocation,
  deleteMap,
  deleteMapLocation,
  getDocByTitle,
  getSetting,
  listCampaigns,
  listMapLocations,
  listMaps,
  setSetting,
  updateCampaign,
  updateMap
} from "../vault/queries";
import { migrateImplicitWorld, seedCampaignIfNeeded } from "../vault/seed";
import { isIndexDoc } from "../vault/indexing";

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

export default function MapsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [mapNameDraft, setMapNameDraft] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const campaigns = useLiveQuery(() => listCampaigns(), [], []);
  const activeCampaign = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );

  const docs = useLiveQuery(
    () =>
      activeCampaignId
        ? db.docs.where("campaignId").equals(activeCampaignId).sortBy("title")
        : Promise.resolve([]),
    [activeCampaignId],
    []
  );

  const maps = useLiveQuery(
    () => (activeCampaignId ? listMaps(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    []
  );

  const mapLocations = useLiveQuery(
    () => (selectedMapId ? listMapLocations(selectedMapId) : Promise.resolve([])),
    [selectedMapId],
    []
  );

  const visibleDocs = useMemo(
    () => (docs ?? []).filter((doc) => !isIndexDoc(doc)),
    [docs]
  );

  const activeMap = useMemo(
    () => (maps ?? []).find((map) => map.id === selectedMapId) ?? null,
    [maps, selectedMapId]
  );

  const locationsWithDocs = useMemo(() => {
    const docMap = new Map((docs ?? []).map((doc) => [doc.id, doc]));
    return (mapLocations ?? []).map((location) => ({
      ...location,
      doc: docMap.get(location.docId) ?? null
    }));
  }, [mapLocations, docs]);

  useEffect(() => {
    const ensureCampaign = async () => {
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await seedCampaignIfNeeded(storedCampaignId);
        await migrateImplicitWorld(storedCampaignId);
        return;
      }

      const existing = await db.campaigns.toArray();
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

  useEffect(() => {
    if (maps && maps.length > 0 && !selectedMapId) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  useEffect(() => {
    if (visibleDocs.length > 0 && !selectedDocId) {
      setSelectedDocId(visibleDocs[0].id);
    }
  }, [visibleDocs, selectedDocId]);

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

  const handleUploadMap = async () => {
    if (!activeCampaignId || !mapFile) return;
    try {
      const dataUrl = await readFileAsDataUrl(mapFile);
      const name =
        mapNameDraft.trim() || mapFile.name.replace(/\.[^/.]+$/, "") || "Untitled Map";
      const map = await createMap(name, dataUrl, activeCampaignId);
      setSelectedMapId(map.id);
      setMapFile(null);
      setMapNameDraft("");
      setFileInputKey((key) => key + 1);
    } catch {
      setMapFile(null);
      setFileInputKey((key) => key + 1);
    }
  };

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!activeMap || !selectedDocId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / rect.width;
    const rawY = (event.clientY - rect.top) / rect.height;
    const x = Math.min(1, Math.max(0, rawX));
    const y = Math.min(1, Math.max(0, rawY));
    createMapLocation(activeMap.id, selectedDocId, x, y).catch(() => undefined);
  };

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
            viewMode="maps"
            onSelectView={(view) => {
              if (view === "worldview") {
                navigate("/");
              } else if (view === "timeline") {
                navigate("/timeline");
              }
            }}
            onCreateCampaign={handleCreateCampaign}
            onUpdateCampaign={(campaignId, updates) => {
              updateCampaign(campaignId, updates).catch(() => undefined);
            }}
          />
        }
        page={
          <div id="maps-page" className="page-panel p-8 space-y-6">
            <div className="chapter-divider pb-4 space-y-2">
              <div className="text-3xl font-display">Maps</div>
              <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
                Upload regional or local maps and pin world notes to locations
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-4 space-y-3">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Upload Map
                  </div>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(event) => setMapFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-xs font-ui"
                  />
                  <input
                    value={mapNameDraft}
                    onChange={(event) => setMapNameDraft(event.target.value)}
                    placeholder="Map name"
                    className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                  />
                  <button
                    onClick={handleUploadMap}
                    disabled={!mapFile || !activeCampaignId}
                    className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft enabled:hover:text-ember disabled:opacity-50"
                  >
                    Add Map
                  </button>
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-4 space-y-3">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Map Library
                  </div>
                  <div className="space-y-2">
                    {(maps ?? []).length === 0 && (
                      <p className="marginal-note">Upload a map to start placing locations.</p>
                    )}
                    {(maps ?? []).map((map) => (
                      <div
                        key={map.id}
                        className={`flex items-center justify-between rounded-xl border border-page-edge px-3 py-2 ${
                          map.id === selectedMapId ? "bg-parchment/90" : "bg-parchment/60"
                        }`}
                      >
                        <button
                          onClick={() => setSelectedMapId(map.id)}
                          className="text-left text-sm font-ui text-ink"
                        >
                          {map.name}
                        </button>
                        <button
                          onClick={() => deleteMap(map.id).catch(() => undefined)}
                          className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-4 space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <input
                        value={activeMap?.name ?? ""}
                        onChange={(event) => {
                          if (!activeMap) return;
                          updateMap(activeMap.id, { name: event.target.value }).catch(
                            () => undefined
                          );
                        }}
                        placeholder="Select a map"
                        disabled={!activeMap}
                        className="w-full text-2xl font-display bg-transparent focus:outline-none disabled:text-ink-soft"
                      />
                    </div>
                    <select
                      value={selectedDocId}
                      onChange={(event) => setSelectedDocId(event.target.value)}
                      className="min-w-[180px] rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    >
                      {visibleDocs.length === 0 && (
                        <option value="">No pages available</option>
                      )}
                      {visibleDocs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="marginal-note">
                    Choose a page, then click on the map to drop a pin.
                  </p>
                  <div
                    onClick={handleMapClick}
                    className={`relative w-full overflow-hidden rounded-2xl border border-page-edge ${
                      activeMap ? "cursor-crosshair" : "cursor-not-allowed"
                    }`}
                  >
                    {activeMap ? (
                      <>
                        <img
                          src={activeMap.imageDataUrl}
                          alt={activeMap.name}
                          className="block w-full h-auto"
                        />
                        {(locationsWithDocs ?? []).map((location) => (
                          <button
                            key={location.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (location.docId) {
                                navigate(`/doc/${location.docId}`);
                              }
                            }}
                            className="absolute h-3 w-3 rounded-full bg-ember shadow-[0_0_0_2px_rgba(255,255,255,0.6)]"
                            style={{
                              left: `${location.x * 100}%`,
                              top: `${location.y * 100}%`,
                              transform: "translate(-50%, -50%)"
                            }}
                            aria-label={location.doc?.title ?? "Map location"}
                            title={location.doc?.title ?? "Open linked page"}
                          />
                        ))}
                      </>
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center text-sm font-ui text-ink-soft">
                        Select a map to begin
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-page-edge bg-parchment/70 p-4 space-y-3">
                  <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                    Linked Locations
                  </div>
                  {(locationsWithDocs ?? []).length === 0 && (
                    <p className="marginal-note">Pins appear here after you drop them.</p>
                  )}
                  <div className="space-y-2">
                    {(locationsWithDocs ?? []).map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between rounded-xl border border-page-edge bg-parchment/80 px-3 py-2"
                      >
                        <button
                          onClick={() => navigate(`/doc/${location.docId}`)}
                          className="text-left text-sm font-ui text-ink"
                        >
                          {location.doc?.title ?? "Untitled Page"}
                        </button>
                        <button
                          onClick={() => {
                            if (!location.id) return;
                            deleteMapLocation(location.id).catch(() => undefined);
                          }}
                          className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
