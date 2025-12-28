import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSupabaseQuery from "../lib/useSupabaseQuery";
import AppShell from "../ui/AppShell";
import HeaderBar from "../ui/HeaderBar";
import MarkdownPreview from "../ui/MarkdownPreview";
import NpcCreateModal from "../ui/components/NpcCreateModal";
import CampaignModal from "../ui/components/CampaignModal";
import { referenceItems } from "../lib/referenceData";
import { summarizeMonster } from "../lib/monster";
import MonsterStatBlock from "../ui/MonsterStatBlock";
import { usePanelCollapse } from "../ui/usePanelCollapse";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { render5eToolsMarkdown } from "../lib/importExport";
import { getTableColumns, summarizeReference, buildReferenceRow } from "../lib/referenceTables";
import { generateEncounter } from "../lib/encounter";
import { calculateCr } from "../lib/crCalculator";
import lootData from "../data/5etools/loot.json";
import { generateLoot } from "../lib/loot";
import type { ReferenceEntry } from "../vault/types";
import {
  createCampaign,
  createDoc,
  getReferenceById,
  getDocByTitle,
  getSetting,
  listCampaigns,
  listDocs,
  listFolders,
  listReferencesBySlug,
  listAllReferences,
  setSetting,
  setNpcProfile,
  createFolder,
  saveDocContent,
  listDmScreenCards,
  createDmScreenCard,
  updateDmScreenCard,
  deleteDmScreenCard
} from "../vault/queries";
import { seedReferencesIfNeeded } from "../vault/referenceSeed";
import { seedCampaignIfNeeded, migrateImplicitWorld } from "../vault/seed";
import { templates } from "../lib/templates";

export default function ReferencePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [theme, setThemeValue] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [crFilter, setCrFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [npcFromBestiaryId, setNpcFromBestiaryId] = useState<string | null>(null);
  const [dmQuery, setDmQuery] = useState("");
  const [draggedCardId, setDraggedCardId] = useState<number | null>(null);
  const [crInputs, setCrInputs] = useState({
    hp: 100,
    ac: 13,
    dpr: 10,
    attack: 3,
    saveDc: 13
  });
  const [encounterConfig, setEncounterConfig] = useState({
    partySize: 4,
    partyLevel: 3,
    difficulty: "medium" as "easy" | "medium" | "hard" | "deadly"
  });
  const [lootConfig, setLootConfig] = useState({
    mode: "individual" as "individual" | "hoard",
    cr: 4
  });
  const referenceSidebarPanel = usePanelCollapse("reference-sidebar");
  const [lootResult, setLootResult] = useState<ReturnType<typeof generateLoot> | null>(null);
  const [encounterResult, setEncounterResult] = useState<ReturnType<typeof generateEncounter> | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const item = useMemo(
    () => referenceItems.find((entry) => entry.slug === slug),
    [slug]
  );

  const references = useSupabaseQuery(
    () => (slug ? listReferencesBySlug(slug) : Promise.resolve([])),
    [slug],
    [],
    { tables: ["references"] }
  );
  const dmCards = useSupabaseQuery(
    () => (activeCampaignId ? listDmScreenCards(activeCampaignId) : Promise.resolve([])),
    [activeCampaignId],
    [],
    { tables: ["dm_screen_cards"] }
  );
  const dmDocs = useSupabaseQuery(
    async () => {
      if (!activeCampaignId) return [];
      const list = await listDocs(activeCampaignId);
      return list.sort((a, b) => a.title.localeCompare(b.title));
    },
    [activeCampaignId],
    [],
    { tables: ["docs"] }
  );
  const dmReferences = useSupabaseQuery(
    () => (slug === "dm-screen" ? listAllReferences() : Promise.resolve([])),
    [slug],
    [],
    { tables: ["references"] }
  );
  const bestiaryAll = useSupabaseQuery(
    () => listReferencesBySlug("bestiary"),
    [],
    [],
    { tables: ["references"] }
  );

  const tableSlugs = useMemo(
    () =>
      new Set([
        "spells",
        "items",
        "traps-hazards",
        "objects",
        "rewards",
        "vehicles",
        "deities",
        "languages",
        "conditions-diseases",
        "actions"
      ]),
    []
  );

  const campaigns = useSupabaseQuery(() => listCampaigns(), [], [], {
    tables: ["campaigns"]
  });

  const activeReference = useSupabaseQuery(
    () => (activeId ? getReferenceById(activeId) : Promise.resolve(undefined)),
    [activeId],
    undefined,
    { tables: ["references"] }
  );

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

  const ensureActiveCampaign = async () => {
    if (activeCampaignId) return activeCampaignId;
    const stored = await getSetting("activeCampaignId");
    if (stored) {
      setActiveCampaignId(stored);
      return stored;
    }
    const campaign = await createCampaign("Campaign One", "");
    setActiveCampaignId(campaign.id);
    await setSetting("activeCampaignId", campaign.id);
    await seedCampaignIfNeeded(campaign.id);
    await migrateImplicitWorld(campaign.id);
    return campaign.id;
  };

  const handleAddDmCard = async (kind: "doc" | "reference", entryId: string) => {
    if (!activeCampaignId) return;
    const columnCards = (dmCardViews ?? []).filter((card) => card.column === 0);
    const position = columnCards.length;
    await createDmScreenCard(activeCampaignId, kind, entryId, 0, position);
  };

  const handleMoveDmCard = async (
    cardId: number,
    targetColumn: number,
    targetIndex: number
  ) => {
    const cards = (dmCardViews ?? []).map((card) => ({ ...card }));
    const moving = cards.find((card) => card.id === cardId);
    if (!moving) return;
    const nextColumns = [0, 1, 2].map((col) =>
      cards
        .filter((card) => card.id !== cardId && card.column === col)
        .sort((a, b) => a.position - b.position)
    );
    const targetList = nextColumns[targetColumn] ?? [];
    targetList.splice(targetIndex, 0, { ...moving, column: targetColumn });
    nextColumns[targetColumn] = targetList;

    const updates: Array<Promise<unknown>> = [];
    nextColumns.forEach((columnCards, colIndex) => {
      columnCards.forEach((card, index) => {
        if (typeof card.id !== "number") return;
        if (card.column !== colIndex || card.position !== index) {
          updates.push(
            updateDmScreenCard(card.id, { column: colIndex, position: index })
          );
        }
      });
    });
    await Promise.all(updates);
  };

  const applyTemplateTitle = (template: string, title: string) =>
    template.replace(/\{\{\s*title\s*\}\}/gi, title || "Untitled");

  const getOrCreateFolder = async (
    name: string,
    parentFolderId: string | null,
    campaignId: string
  ) => {
    const existing = (await listFolders(campaignId)).find(
      (folder) =>
        folder.name === name && folder.parentFolderId === parentFolderId
    );
    if (existing) return existing;
    return createFolder(name, parentFolderId, campaignId);
  };

  useEffect(() => {
    seedReferencesIfNeeded().catch(() => undefined);
  }, []);

  useEffect(() => {
    const applyTheme = async () => {
      const stored = await getSetting("theme");
      if (stored === "dark" || stored === "light") {
        setThemeValue(stored);
      }
    };
    applyTheme().catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadCampaign = async () => {
      const stored = await getSetting("activeCampaignId");
      if (stored) {
        setActiveCampaignId(stored);
        await migrateImplicitWorld(stored);
      }
    };
    loadCampaign().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    setActiveId(null);
    setQuery("");
  }, [slug]);

  useEffect(() => {
    const entry = searchParams.get("entry");
    if (entry) {
      setActiveId(entry);
    }
  }, [searchParams]);

  const bestiaryEntries = useMemo(() => {
    if (slug !== "bestiary") return [];
    return (references ?? [])
      .map((entry) => ({
        entry,
        summary: summarizeMonster(entry.rawJson)
      }))
      .filter((item) => item.summary);
  }, [references, slug]);

  const availableTypes = useMemo(() => {
    const values = new Set<string>();
    bestiaryEntries.forEach(({ summary }) => {
      if (summary?.type) values.add(summary.type);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [bestiaryEntries]);

  const availableCr = useMemo(() => {
    const values = new Set<string>();
    bestiaryEntries.forEach(({ summary }) => {
      if (summary?.cr) values.add(summary.cr);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [bestiaryEntries]);

  const filtered = (references ?? []).filter((entry) =>
    entry.name.toLowerCase().includes(query.toLowerCase())
  );

  const tableColumns = useMemo(() => getTableColumns(slug ?? ""), [slug]);

  const tableRows = useMemo(() => {
    if (!slug || !tableSlugs.has(slug)) return [];
    return (references ?? [])
      .map((entry) => {
        if (!entry.rawJson) return null;
        const payload = buildReferenceRow(entry.rawJson);
        const detail = payload ? render5eToolsMarkdown(payload) : entry.content || "";
        const summary = summarizeReference(slug, entry.rawJson, detail);
        if (!summary) return null;
        return { entry, summary, detail };
      })
      .filter((row): row is { entry: ReferenceEntry; summary: NonNullable<ReturnType<typeof summarizeReference>>; detail: string } => Boolean(row));
  }, [references, slug, tableSlugs]);

  const filteredTableRows = useMemo(() => {
    if (!tableRows.length) return [];
    const lower = query.toLowerCase();
    return tableRows.filter((row) => {
      if (!lower) return true;
      return (
        row.summary.name.toLowerCase().includes(lower) ||
        row.detail.toLowerCase().includes(lower)
      );
    });
  }, [query, tableRows]);

  const dmCardViews = useMemo(() => {
    const cards = dmCards ?? [];
    const docMap = new Map((dmDocs ?? []).map((doc) => [doc.id, doc]));
    const refMap = new Map((dmReferences ?? []).map((ref) => [ref.id, ref]));
    return cards
      .map((card) => {
        if (card.kind === "doc") {
          const doc = docMap.get(card.entryId);
          if (!doc) return null;
          return {
            ...card,
            title: doc.title,
            body: doc.body,
            kind: "doc" as const
          };
        }
        const ref = refMap.get(card.entryId);
        if (!ref) return null;
        const payload = ref.rawJson ? buildReferenceRow(ref.rawJson) : null;
        const body = payload ? render5eToolsMarkdown(payload) : ref.content;
        return {
          ...card,
          title: ref.name,
          body,
          kind: "reference" as const,
          slug: ref.slug
        };
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card));
  }, [dmCards, dmDocs, dmReferences]);

  const dmColumns = useMemo(() => {
    const columns = [0, 1, 2].map((index) => ({
      index,
      cards: dmCardViews
        .filter((card) => card.column === index)
        .sort((a, b) => a.position - b.position)
    }));
    return columns;
  }, [dmCardViews]);

  const dmSearchResults = useMemo(() => {
    if (!dmQuery.trim()) return [];
    const lower = dmQuery.toLowerCase();
    const docMatches = (dmDocs ?? [])
      .filter((doc) => doc.title.toLowerCase().includes(lower))
      .slice(0, 8)
      .map((doc) => ({ kind: "doc" as const, id: doc.id, title: doc.title }));
    const refMatches = (dmReferences ?? [])
      .filter((ref) => ref.name.toLowerCase().includes(lower))
      .slice(0, 12)
      .map((ref) => ({ kind: "reference" as const, id: ref.id, title: ref.name }));
    return [...docMatches, ...refMatches].slice(0, 16);
  }, [dmQuery, dmDocs, dmReferences]);

  const encounterMonsters = useMemo(() => {
    return (bestiaryAll ?? [])
      .map((entry) => {
        if (!entry.rawJson) return null;
        const payload = buildReferenceRow(entry.rawJson);
        if (!payload) return null;
        const cr = payload.cr ? String(payload.cr) : null;
        if (!cr) return null;
        return { id: entry.id, name: entry.name, cr };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [bestiaryAll]);

  const filteredBestiary = bestiaryEntries.filter(({ summary }) => {
    if (!summary) return false;
    const matchQuery = summary.name.toLowerCase().includes(query.toLowerCase());
    const matchType = typeFilter === "all" ? true : summary.type === typeFilter;
    const matchCr = crFilter === "all" ? true : summary.cr === crFilter;
    return matchQuery && matchType && matchCr;
  });

  useEffect(() => {
    if (activeId) return;
    if (slug === "bestiary") return;
    if (tableSlugs.has(slug ?? "")) return;
    if ((references ?? []).length > 0) {
      setActiveId((references ?? [])[0]?.id ?? null);
    }
  }, [activeId, references, slug, tableSlugs]);

  return (
    <>
      <AppShell
      header={
        <HeaderBar
          docs={[]}
          onOpenDoc={(docId) => {
            void docId;
          }}
          onNavigateReference={(target) => navigate(`/reference/${target}`)}
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
        <div id="reference-sidebar" className="page-panel p-4">
          <div className="flex items-center justify-between chapter-divider pb-3">
            <div className="font-display text-lg">{item?.label ?? "Reference"}</div>
            <button
              onClick={referenceSidebarPanel.toggle}
              aria-label={referenceSidebarPanel.collapsed ? "Expand panel" : "Minimize panel"}
              className="text-ink-soft hover:text-ember"
            >
              {referenceSidebarPanel.collapsed ? (
                <ChevronDownIcon size={14} />
              ) : (
                <ChevronUpIcon size={14} />
              )}
            </button>
          </div>
          {!referenceSidebarPanel.collapsed &&
            (slug === "dm-screen" ? (
              <>
                <input
                  value={dmQuery}
                  onChange={(event) => setDmQuery(event.target.value)}
                  placeholder="Search docs or references..."
                  id="reference-search"
                  className="mt-3 w-full rounded-full border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                />
                <div className="mt-4 space-y-2 max-h-[60vh] overflow-auto pr-1">
                  {dmQuery.trim().length === 0 && (
                    <p className="marginal-note">
                      Search to add world pages or references to the DM screen.
                    </p>
                  )}
                  {dmSearchResults.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      onClick={() => handleAddDmCard(result.kind, result.id)}
                      className="block w-full text-left rounded-lg border border-page-edge px-3 py-2 text-sm text-ink-soft hover:text-ink"
                    >
                      <span className="mr-2 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                        {result.kind === "doc" ? "World" : "Reference"}
                      </span>
                      {result.title}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={slug === "bestiary" ? "Search creatures..." : "Search SRD..."}
                  id="reference-search"
                  className="mt-3 w-full rounded-full border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                />
                {slug === "bestiary" && (
                  <div className="mt-4 grid gap-2">
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
                    >
                      <option value="all">All types</option>
                      {availableTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={crFilter}
                      onChange={(event) => setCrFilter(event.target.value)}
                      className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
                    >
                      <option value="all">All CR</option>
                      {availableCr.map((cr) => (
                        <option key={cr} value={cr}>
                          CR {cr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {slug !== "bestiary" && !tableSlugs.has(slug ?? "") && (
                  <div
                    id="reference-list"
                    className="mt-4 space-y-2 max-h-[60vh] overflow-auto pr-1"
                  >
                    {filtered.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setActiveId(entry.id)}
                        className={`block w-full text-left rounded-lg border border-page-edge px-3 py-2 text-sm ${
                          entry.id === activeId
                            ? "bg-parchment/80 text-ink"
                            : "text-ink-soft hover:text-ink"
                        } wb-tooltip`}
                        data-tooltip={`Open ${entry.name}`}
                      >
                        {entry.name}
                        <span className="ml-2 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                          {entry.source}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ))}
        </div>
      }
      page={
        <div id="reference-content" className="page-panel p-8 space-y-6">
          <div className="chapter-divider pb-4">
            <div className="text-3xl font-display">
              {item?.label ?? "Reference"}
            </div>
            <div className="mt-2 text-sm font-ui uppercase tracking-[0.2em] text-ink-soft">
              {slug === "bestiary" ? "Creature compendium" : "Reference Shelf"}
            </div>
          </div>
          {slug === "dm-screen" ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                {dmColumns.map((column) => (
                  <div
                    key={`dm-col-${column.index}`}
                    className="rounded-3xl border border-page-edge bg-parchment/70 p-4 space-y-3"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      if (draggedCardId === null) return;
                      await handleMoveDmCard(draggedCardId, column.index, column.cards.length);
                      setDraggedCardId(null);
                    }}
                  >
                    <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                      Stack {column.index + 1}
                    </div>
                    {column.cards.length === 0 && (
                      <p className="marginal-note">Drop cards here.</p>
                    )}
                    {column.cards.map((card, index) => (
                      <div
                        key={card.id ?? `${card.entryId}-${index}`}
                        draggable
                        onDragStart={() => {
                          if (typeof card.id !== "number") return;
                          setDraggedCardId(card.id);
                        }}
                        onDragEnd={() => setDraggedCardId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={async () => {
                          if (draggedCardId === null) return;
                          await handleMoveDmCard(draggedCardId, column.index, index);
                          setDraggedCardId(null);
                        }}
                        className="rounded-2xl border border-page-edge bg-parchment/80 p-3 space-y-2 cursor-grab"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-display text-base text-ink">{card.title}</div>
                          <button
                            onClick={() => {
                              if (typeof card.id !== "number") return;
                              deleteDmScreenCard(card.id);
                            }}
                            className="text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                          >
                            Remove
                          </button>
                        </div>
                        {card.body ? (
                          <div className="max-h-48 overflow-y-auto pr-1">
                            <MarkdownPreview
                              content={card.body}
                              onOpenLink={(target) => {
                                if (card.kind === "doc" && target.startsWith("doc:")) {
                                  navigate(`/doc/${target.replace("doc:", "")}`);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <p className="marginal-note">No details available.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : slug === "encounter-generator" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  Encounter Inputs
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={encounterConfig.partySize}
                    onChange={(event) =>
                      setEncounterConfig((current) => ({
                        ...current,
                        partySize: Number(event.target.value)
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Party size"
                  />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={encounterConfig.partyLevel}
                    onChange={(event) =>
                      setEncounterConfig((current) => ({
                        ...current,
                        partyLevel: Number(event.target.value)
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Party level"
                  />
                  <select
                    value={encounterConfig.difficulty}
                    onChange={(event) =>
                      setEncounterConfig((current) => ({
                        ...current,
                        difficulty: event.target.value as "easy" | "medium" | "hard" | "deadly"
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="deadly">Deadly</option>
                  </select>
                </div>
                <button
                  onClick={() =>
                    setEncounterResult(
                      generateEncounter({
                        monsters: encounterMonsters,
                        partySize: encounterConfig.partySize,
                        partyLevel: encounterConfig.partyLevel,
                        difficulty: encounterConfig.difficulty
                      })
                    )
                  }
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                >
                  Generate Encounter
                </button>
              </div>
              {encounterResult && (
                <div className="rounded-3xl border border-page-edge bg-parchment/80 p-5 space-y-3">
                  <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Encounter Results
                  </div>
                  <div className="text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Budget {encounterResult.budget} XP · Total {encounterResult.totalXp} XP
                  </div>
                  <div className="space-y-2">
                    {encounterResult.results.map((entry, index) => (
                      <div
                        key={`${entry.name}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-page-edge bg-parchment/70 px-3 py-2 text-sm"
                      >
                        <span>{entry.name}</span>
                        <span className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                          CR {entry.cr} · {entry.xp} XP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : slug === "loot-generator" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  Loot Inputs
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={lootConfig.mode}
                    onChange={(event) =>
                      setLootConfig((current) => ({
                        ...current,
                        mode: event.target.value as "individual" | "hoard"
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                  >
                    <option value="individual">Individual</option>
                    <option value="hoard">Hoard</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={lootConfig.cr}
                    onChange={(event) =>
                      setLootConfig((current) => ({
                        ...current,
                        cr: Number(event.target.value)
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="CR"
                  />
                </div>
                <button
                  onClick={() =>
                    setLootResult(generateLoot(lootData, lootConfig.cr, lootConfig.mode))
                  }
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                >
                  Generate Loot
                </button>
              </div>
              {lootResult && (
                <div className="rounded-3xl border border-page-edge bg-parchment/80 p-5 space-y-3">
                  <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Loot Results
                  </div>
                  {lootResult.coins.length > 0 && (
                    <div>
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Coins
                      </div>
                      <div className="mt-1 space-y-1 text-sm">
                        {lootResult.coins.map((coin, index) => (
                          <div key={`${coin}-${index}`}>{coin}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lootResult.valuables.length > 0 && (
                    <div>
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Valuables
                      </div>
                      <div className="mt-1 space-y-1 text-sm">
                        {lootResult.valuables.map((value, index) => (
                          <div key={`${value}-${index}`}>{value}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lootResult.magicItems.length > 0 && (
                    <div>
                      <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                        Magic Items
                      </div>
                      <div className="mt-1 space-y-1 text-sm">
                        {lootResult.magicItems.map((item, index) => (
                          <div key={`${item}-${index}`}>{item}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : slug === "cr-calculator" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-page-edge bg-parchment/70 p-5 space-y-4">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  CR Inputs
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="number"
                    value={crInputs.hp}
                    onChange={(event) =>
                      setCrInputs((current) => ({ ...current, hp: Number(event.target.value) }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Hit Points"
                  />
                  <input
                    type="number"
                    value={crInputs.ac}
                    onChange={(event) =>
                      setCrInputs((current) => ({ ...current, ac: Number(event.target.value) }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Armor Class"
                  />
                  <input
                    type="number"
                    value={crInputs.dpr}
                    onChange={(event) =>
                      setCrInputs((current) => ({ ...current, dpr: Number(event.target.value) }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Damage per Round"
                  />
                  <input
                    type="number"
                    value={crInputs.attack}
                    onChange={(event) =>
                      setCrInputs((current) => ({
                        ...current,
                        attack: Number(event.target.value)
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Attack Bonus"
                  />
                  <input
                    type="number"
                    value={crInputs.saveDc}
                    onChange={(event) =>
                      setCrInputs((current) => ({
                        ...current,
                        saveDc: Number(event.target.value)
                      }))
                    }
                    className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
                    placeholder="Save DC"
                  />
                </div>
              </div>
              <div className="rounded-3xl border border-page-edge bg-parchment/80 p-5 space-y-3">
                <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                  CR Results
                </div>
                {(() => {
                  const result = calculateCr(crInputs);
                  return (
                    <div className="grid gap-2 text-sm">
                      <div>
                        Defensive CR: {result.defensive.cr} (AC {result.defensive.ac})
                      </div>
                      <div>
                        Offensive CR: {result.offensive.cr} (Attack {result.offensive.attack})
                      </div>
                      <div className="text-lg font-display">
                        Final CR: {result.final.cr}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : slug === "bestiary" ? (
            <>
              <div className="rounded-3xl border border-page-edge bg-parchment/70 p-4">
                <div className="grid grid-cols-[2fr_0.7fr_0.9fr_0.6fr_0.6fr_0.7fr] gap-3 text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft pb-2 border-b border-page-edge">
                  <div>Name</div>
                  <div>CR</div>
                  <div>Type</div>
                  <div>AC</div>
                  <div>HP</div>
                  <div>Source</div>
                </div>
                <div className="mt-2 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredBestiary.length === 0 && (
                    <p className="marginal-note">
                      No creatures match the current filters.
                    </p>
                  )}
                  {filteredBestiary.map(({ entry, summary }) => {
                    const isActive = entry.id === activeId;
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl border border-page-edge transition ${
                          isActive ? "bg-parchment/80 text-ink" : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        <button
                          onClick={() => setActiveId(isActive ? null : entry.id)}
                          className="grid w-full grid-cols-[2fr_0.7fr_0.9fr_0.6fr_0.6fr_0.7fr] gap-3 px-3 py-2 text-left text-sm"
                        >
                          <div className="font-display text-base text-ink">{summary?.name}</div>
                          <div className="text-xs font-ui uppercase tracking-[0.18em]">
                            {summary?.cr}
                          </div>
                          <div className="text-xs font-ui uppercase tracking-[0.18em]">
                            {summary?.type}
                          </div>
                          <div className="text-xs font-ui uppercase tracking-[0.18em]">
                            {summary?.ac}
                          </div>
                          <div className="text-xs font-ui uppercase tracking-[0.18em]">
                            {summary?.hp}
                          </div>
                          <div className="text-xs font-ui uppercase tracking-[0.18em]">
                            {summary?.source}
                          </div>
                        </button>
                        <div
                          className={`monster-row-details ${
                            isActive ? "monster-row-details--open" : ""
                          }`}
                        >
                          <div className="px-3 pb-3">
                            <MonsterStatBlock
                              rawJson={entry.rawJson}
                              onCreateNpc={() => setNpcFromBestiaryId(entry.id)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : tableSlugs.has(slug ?? "") ? (
            <div className="rounded-3xl border border-page-edge bg-parchment/70 p-4">
              <div
                className="grid gap-3 text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft pb-2 border-b border-page-edge"
                style={{
                  gridTemplateColumns: `2fr ${tableColumns
                    .map(() => "minmax(0, 1fr)")
                    .join(" ")}`
                }}
              >
                <div>Name</div>
                {tableColumns.map((column) => (
                  <div key={column}>{column}</div>
                ))}
              </div>
              <div className="mt-2 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredTableRows.length === 0 && (
                  <p className="marginal-note">No entries match the current filters.</p>
                )}
                {filteredTableRows.map((row) => {
                  const isActive = row.entry.id === activeId;
                  return (
                    <div
                      key={row.entry.id}
                      className={`rounded-2xl border border-page-edge transition ${
                        isActive ? "bg-parchment/80 text-ink" : "text-ink-soft hover:text-ink"
                      }`}
                    >
                      <button
                        onClick={() => setActiveId(isActive ? null : row.entry.id)}
                        className="grid w-full gap-3 px-3 py-2 text-left text-sm"
                        style={{
                          gridTemplateColumns: `2fr ${tableColumns
                            .map(() => "minmax(0, 1fr)")
                            .join(" ")}`
                        }}
                      >
                        <div className="font-display text-base text-ink">{row.summary.name}</div>
                        {row.summary.columns.map((value, index) => (
                          <div
                            key={`${row.entry.id}-col-${index}`}
                            className="text-xs font-ui uppercase tracking-[0.18em]"
                          >
                            {value}
                          </div>
                        ))}
                      </button>
                      <div
                        className={`monster-row-details ${
                          isActive ? "monster-row-details--open" : ""
                        }`}
                      >
                        <div className="px-3 pb-3">
                          {row.detail ? (
                            <MarkdownPreview
                              content={row.detail}
                              onOpenLink={() => undefined}
                            />
                          ) : (
                            <p className="marginal-note">No details available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeReference?.content ? (
            <div className="mt-2">
              <div className="text-2xl font-display">{activeReference.name}</div>
              <div className="mt-1 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                {activeReference.source ? `SRD • ${activeReference.source}` : "Reference"}
              </div>
              <div className="mt-6">
                <MarkdownPreview content={activeReference.content} onOpenLink={() => undefined} />
              </div>
            </div>
          ) : (
            <p className="mt-6 text-ink-soft">
              Select an entry from the reference shelf to view the SRD excerpt.
            </p>
          )}
        </div>
      }
      marginalia={null}
      />
      <NpcCreateModal
        isOpen={Boolean(npcFromBestiaryId)}
        creatures={(bestiaryEntries ?? []).map(({ entry }) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source
        }))}
        onClose={() => setNpcFromBestiaryId(null)}
        initialCreatureId={npcFromBestiaryId}
        onCreate={async (title, creatureId) => {
          if (!creatureId) return;
          const campaignId = await ensureActiveCampaign();
          const peopleFolder = await getOrCreateFolder("People", null, campaignId);
          const targetFolder = await getOrCreateFolder(
            "Notable Figures",
            peopleFolder?.id ?? null,
            campaignId
          );
          const template = templates.find((entry) => entry.id === "npc");
          const doc = await createDoc(
            title || "Unnamed NPC",
            targetFolder?.id ?? null,
            campaignId
          );
          if (template) {
            const content = applyTemplateTitle(template.content, title || doc.title);
            await saveDocContent(doc.id, content);
          }
          await setNpcProfile(doc.id, creatureId);
          navigate(`/doc/${doc.id}`);
          setNpcFromBestiaryId(null);
        }}
      />
      <CampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreate={handleSubmitCampaign}
      />
    </>
  );
}
