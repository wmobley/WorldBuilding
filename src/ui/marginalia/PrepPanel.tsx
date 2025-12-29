import { useEffect, useMemo, useState } from "react";
import type { PrepHelpers } from "../../prep/helpers";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";
import { buildInitiativeOrder } from "../../prep/initiative";
import { buildTreasureSuggestion, type TreasureMonster } from "../../prep/treasure";
import lootData from "../../data/5etools/loot.json";
import Modal from "../components/Modal";
import type { ReferenceEntry } from "../../vault/types";
import { tagVocabulary } from "../../domain/tags/vocabulary";
import { buildReferenceRow } from "../../lib/referenceTables";
import { getEncounterBudget } from "../../lib/encounter";
import { sendPromptToProvider, type AiProvider } from "../../ai/client";
import { getSetting } from "../../vault/queries";

type PartyConfig = {
  size: number;
  level: number;
  difficulty: "easy" | "medium" | "hard" | "deadly";
};

type PrepModalKey =
  | "encounter"
  | "involved"
  | "recent"
  | "initiative"
  | "treasure"
  | null;

export default function PrepPanel({
  prepHelpers,
  variant = "panel",
  partyConfig,
  onPartyConfigChange,
  bestiaryReferences,
  since,
  onSinceChange
}: {
  prepHelpers: PrepHelpers | null;
  variant?: "panel" | "toolbar";
  partyConfig: PartyConfig;
  onPartyConfigChange: (next: PartyConfig) => void;
  bestiaryReferences: ReferenceEntry[];
  since: string;
  onSinceChange: (value: string) => void;
}) {
  const panel = usePanelCollapse("marginalia-prep");
  const [activeModal, setActiveModal] = useState<PrepModalKey>(null);
  const [initiativePayload, setInitiativePayload] = useState(
    JSON.stringify(
      {
        players: [
          { name: "Aria", initiativeRoll: 15 },
          { name: "Borin", initiativeRoll: 8 }
        ],
        monsters: [
          { name: "Goblin Boss", dexMod: 2 },
          { name: "Goblin", dexMod: 2, count: 2 }
        ]
      },
      null,
      2
    )
  );
  const [initiativeSeed, setInitiativeSeed] = useState("goblin");
  const [initiativeResult, setInitiativeResult] = useState<ReturnType<
    typeof buildInitiativeOrder
  > | null>(null);
  const [initiativeError, setInitiativeError] = useState("");

  const [treasurePayload, setTreasurePayload] = useState(
    JSON.stringify(
      {
        monsters: [
          { name: "Goblin Boss", cr: 1 },
          { name: "Goblin", cr: 0.25 },
          { name: "Goblin", cr: 0.25 }
        ]
      },
      null,
      2
    )
  );
  const [treasureSeed, setTreasureSeed] = useState("goblin-loot");
  const [lootType, setLootType] = useState<"individual" | "hoard">("individual");
  const [treasureResult, setTreasureResult] = useState<ReturnType<
    typeof buildTreasureSuggestion
  > | null>(null);
  const [treasureError, setTreasureError] = useState("");
  const [encounterLocation, setEncounterLocation] = useState("");
  const [aiEncounterResult, setAiEncounterResult] = useState<string | null>(null);
  const [aiEncounterProvider, setAiEncounterProvider] = useState<string | null>(null);
  const [aiEncounterError, setAiEncounterError] = useState<string | null>(null);
  const [aiEncounterLoading, setAiEncounterLoading] = useState(false);

  useEffect(() => {
    if (encounterLocation) return;
    const preferred = prepHelpers?.suggestEncounter.logic.terrainTags?.[0];
    if (preferred) {
      setEncounterLocation(preferred);
    }
  }, [encounterLocation, prepHelpers]);

  const handleInitiativeRun = () => {
    try {
      const parsed = JSON.parse(initiativePayload) as {
        players?: Array<{ name: string; initiativeRoll?: number; dexMod?: number }>;
        monsters?: Array<{ name: string; dexMod: number; count?: number }>;
      };
      setInitiativeResult(
        buildInitiativeOrder({
          players: parsed.players ?? [],
          monsters: parsed.monsters ?? [],
          seed: initiativeSeed.trim() || undefined
        })
      );
      setInitiativeError("");
    } catch (error) {
      setInitiativeError(error instanceof Error ? error.message : "Invalid JSON");
      setInitiativeResult(null);
    }
  };

  const handleTreasureRun = () => {
    try {
      const parsed = JSON.parse(treasurePayload) as {
        monsters?: TreasureMonster[];
      };
      setTreasureResult(
        buildTreasureSuggestion({
          monsters: parsed.monsters ?? [],
          lootType,
          lootData,
          seed: treasureSeed.trim() || undefined
        })
      );
      setTreasureError("");
    } catch (error) {
      setTreasureError(error instanceof Error ? error.message : "Invalid JSON");
      setTreasureResult(null);
    }
  };

  const encounterMarkdown = useMemo(() => {
    if (!prepHelpers) return "No encounter data yet.";
    const encounter = prepHelpers.suggestEncounter;
    const rolls = encounter.encounterPlan.rolls.map((roll) => `d100 ${roll}`).join(", ");
    const buckets = encounter.encounterPlan.crBuckets.join(", ");
    const tableTitle = encounter.inputsUsed.table?.title ?? "Unknown table";
    const selection = encounter.logic.selection;
    const results = encounter.results
      .map((entry) => {
        const monsters = entry.monsterSuggestions.length
          ? entry.monsterSuggestions
              .map((monster) => `${monster.count} ${monster.name}`)
              .join(", ")
          : "None";
        const homebrew = entry.needsHomebrew ? " (homebrew)" : "";
        return [
          `- d100 ${entry.roll} (${entry.range[0]}-${entry.range[1]}) — ${entry.text} [${entry.crBucket}]${homebrew}`,
          `  - Monsters: ${monsters}`
        ].join("\n");
      })
      .join("\n");
    return [
      "## Suggest Encounter",
      `Party: level ${encounter.logic.party.level}, size ${encounter.logic.party.size} (${encounter.logic.party.difficulty})`,
      `Table: ${tableTitle} (${selection})`,
      `CR buckets: ${buckets || "None"}`,
      `Rolls: ${rolls || "None"}`,
      `Budget: ${encounter.encounterPlan.budget} XP`,
      "",
      "### Encounters",
      results || "- None"
    ].join("\n");
  }, [prepHelpers]);

  const involvedMarkdown = useMemo(() => {
    if (!prepHelpers) return "No involvement data yet.";
    const entries = prepHelpers.whosInvolved.results
      .map(
        (entry) =>
          `- ${entry.title} (${entry.type}) — ${entry.sources.join(", ")}`
      )
      .join("\n");
    return ["## Who's Involved", entries || "- None"].join("\n");
  }, [prepHelpers]);

  const recentMarkdown = useMemo(() => {
    if (!prepHelpers) return "No recent changes yet.";
    const entries = prepHelpers.whatChangedRecently.results
      .map(
        (entry) =>
          `- ${entry.updatedAt.slice(0, 10)} — ${entry.title}: ${
            entry.change ?? "No summary provided."
          } (${entry.reason})`
      )
      .join("\n");
    return ["## What Changed Recently", entries || "- None"].join("\n");
  }, [prepHelpers]);

  const initiativeMarkdown = useMemo(() => {
    if (!initiativeResult) return "Run initiative to generate output.";
    const entries = initiativeResult.initiativeOrder
      .map(
        (entry, index) =>
          `${index + 1}. ${entry.name} — ${entry.initiative} (roll ${entry.roll} + ${entry.dexMod})`
      )
      .join("\n");
    return ["## Initiative Order", entries || "- None"].join("\n");
  }, [initiativeResult]);

  const treasureMarkdown = useMemo(() => {
    if (!treasureResult) return "Run treasure to generate output.";
    const coins = Object.entries(treasureResult.coins)
      .map(([coin, amount]) => `- ${amount} ${coin}`)
      .join("\n");
    const valuables = treasureResult.valuables.map((item) => `- ${item}`).join("\n");
    const items = treasureResult.items.map((item) => `- ${item}`).join("\n");
    return [
      "## Treasure Suggestion",
      "### Coins",
      coins || "- None",
      "",
      "### Valuables",
      valuables || "- None",
      "",
      "### Items",
      items || "- None"
    ].join("\n");
  }, [treasureResult]);

  const terrainOptions = useMemo(() => {
    const terrain = tagVocabulary.find((entry) => entry.namespace === "terrain");
    return (terrain?.values ?? []).slice();
  }, []);

  const normalizeTerrain = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "hill") return "hills";
    if (normalized === "mountain") return "mountains";
    return normalized;
  };

  const parseCrValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes("/")) {
      const [num, den] = trimmed.split("/").map(Number);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
      return num / den;
    }
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : null;
  };

  const crRange = useMemo(() => {
    const difficultyShift = {
      easy: -1,
      medium: 0,
      hard: 1,
      deadly: 2
    } as const;
    const target = partyConfig.level + difficultyShift[partyConfig.difficulty];
    const min = Math.max(0, target - 2);
    const max = Math.min(30, target + 2);
    return { min, max };
  }, [partyConfig.difficulty, partyConfig.level]);

  const encounterMonsters = useMemo(() => {
    return (bestiaryReferences ?? [])
      .map((entry) => {
        if (!entry.rawJson) return null;
        const payload = buildReferenceRow(entry.rawJson);
        if (!payload) return null;
        const cr = payload.cr ? String(payload.cr) : null;
        if (!cr) return null;
        const environments = Array.isArray(payload.environment)
          ? payload.environment.map((value) => String(value))
          : [];
        return { name: entry.name, cr, environments };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [bestiaryReferences]);

  const encounterPool = useMemo(() => {
    const location = normalizeTerrain(encounterLocation);
    const locationFiltered =
      location.length === 0
        ? encounterMonsters
        : encounterMonsters.filter((entry) =>
            entry.environments.map(normalizeTerrain).includes(location)
          );
    const crFiltered = locationFiltered.filter((entry) => {
      const crValue = parseCrValue(entry.cr);
      if (crValue === null) return false;
      return crValue >= crRange.min && crValue <= crRange.max;
    });
    if (crFiltered.length > 0) return crFiltered;
    if (locationFiltered.length > 0) return locationFiltered;
    return encounterMonsters;
  }, [encounterLocation, encounterMonsters, crRange]);

  const buildEncounterPrompt = ({
    location,
    partySize,
    partyLevel,
    difficulty,
    budget,
    candidates
  }: {
    location: string;
    partySize: number;
    partyLevel: number;
    difficulty: "easy" | "medium" | "hard" | "deadly";
    budget: number;
    candidates: Array<{ name: string; cr: string; environments: string[] }>;
  }) => {
    const locationLabel = location ? normalizeTerrain(location) : "any";
    const lines = candidates.map((entry) => {
      const env = entry.environments.length > 0 ? entry.environments.join(", ") : "any";
      return `- ${entry.name} | CR ${entry.cr} | ${env}`;
    });
    return [
      "You are a DM assistant. Build one D&D 5e encounter using only the monsters listed.",
      `Location/terrain: ${locationLabel}.`,
      `Party: ${partySize} characters, level ${partyLevel}. Difficulty: ${difficulty}.`,
      `Target XP budget: ${budget}. Target CR band: ${crRange.min}-${crRange.max}.`,
      "",
      "Return markdown with these sections:",
      "## Encounter Summary",
      "## Monsters (name — CR — count)",
      "## Tactics",
      "## Hooks",
      "## XP Math",
      "",
      "Available monsters:",
      ...lines
    ].join("\n");
  };

  const handleAiEncounter = async () => {
    setAiEncounterError(null);
    setAiEncounterResult(null);
    setAiEncounterProvider(null);
    setAiEncounterLoading(true);
    try {
      const [
        aiProvider,
        openAiKey,
        openAiModel,
        openAiBaseUrl,
        ollamaModel,
        ollamaBaseUrl
      ] = await Promise.all([
        getSetting("aiProvider"),
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiOllamaModel"),
        getSetting("aiOllamaBaseUrl")
      ]);
      const provider = (aiProvider || "none") as AiProvider;
      const budget = getEncounterBudget({
        partySize: partyConfig.size,
        partyLevel: partyConfig.level,
        difficulty: partyConfig.difficulty
      });
      const candidates = encounterPool
        .slice(0, 160)
        .map((entry) => ({
          name: entry.name,
          cr: entry.cr,
          environments: entry.environments.map(normalizeTerrain)
        }));
      const prompt = buildEncounterPrompt({
        location: encounterLocation,
        partySize: partyConfig.size,
        partyLevel: partyConfig.level,
        difficulty: partyConfig.difficulty,
        budget,
        candidates
      });
      const response = await sendPromptToProvider({
        provider,
        prompt,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      setAiEncounterResult(response.content);
      setAiEncounterProvider(response.providerLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      setAiEncounterError(message);
    } finally {
      setAiEncounterLoading(false);
    }
  };

  const actionSelect = (
    <label
      className="flex items-center gap-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
      data-tooltip="Build prep outputs"
    >
      Suggest:
      <select
        value={activeModal ?? ""}
        onChange={(event) => {
          const value = event.target.value as PrepModalKey;
          setActiveModal(value || null);
        }}
        className="rounded-full border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-ui text-ink"
      >
        <option value="">Select</option>
        <option value="encounter">Encounter</option>
        <option value="involved">Who&apos;s Involved</option>
        <option value="recent">What Changed</option>
        <option value="initiative">Initiative</option>
        <option value="treasure">Treasure</option>
      </select>
    </label>
  );

  return (
    <>
      {variant === "toolbar" ? (
        <div className="flex items-center gap-2">{actionSelect}</div>
      ) : (
        <div id="marginalia-prep" className="page-panel p-4">
          <div className="flex items-center justify-between chapter-divider pb-3">
            <div className="font-display text-lg">Prep Helpers</div>
            <button
              onClick={panel.toggle}
              aria-label={panel.collapsed ? "Expand panel" : "Minimize panel"}
              className="text-ink-soft hover:text-ember"
            >
              {panel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
            </button>
          </div>
          {!panel.collapsed && (
            <div className="space-y-4">
              {!prepHelpers && (
                <p className="text-xs text-ink-soft">
                  Open a page to generate prep helpers.
                </p>
              )}
              {prepHelpers && <div className="flex items-center gap-2">{actionSelect}</div>}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={activeModal === "encounter"}
        title="Suggest Encounter"
        onClose={() => setActiveModal(null)}
      >
        <p className="text-xs text-ink-soft">
          Uses terrain/creature tags, CR buckets, and party data to generate a deterministic
          encounter summary.
        </p>
        <div className="grid gap-2 md:grid-cols-4">
          <label
            className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Number of player characters."
          >
            Party Size
            <input
              type="number"
              min={1}
              max={10}
              value={partyConfig.size}
              onChange={(event) =>
                onPartyConfigChange({
                  ...partyConfig,
                  size: Number(event.target.value)
                })
              }
              className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            />
          </label>
          <label
            className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Average party level for CR targeting."
          >
            Party Level
            <input
              type="number"
              min={1}
              max={20}
              value={partyConfig.level}
              onChange={(event) =>
                onPartyConfigChange({
                  ...partyConfig,
                  level: Number(event.target.value)
                })
              }
              className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            />
          </label>
          <label
            className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Filter candidates by terrain."
          >
            Location
            <select
              value={encounterLocation}
              onChange={(event) => setEncounterLocation(event.target.value)}
              className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            >
              <option value="">Any terrain</option>
              {terrainOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label
            className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
            data-tooltip="Adjusts the CR band and XP budget."
          >
            Difficulty
            <select
              value={partyConfig.difficulty}
              onChange={(event) =>
                onPartyConfigChange({
                  ...partyConfig,
                  difficulty: event.target.value as PartyConfig["difficulty"]
                })
              }
              className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="deadly">Deadly</option>
            </select>
          </label>
        </div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip" data-tooltip="CR band and pool size used for AI suggestions.">
            Target CR {crRange.min}-{crRange.max} · {encounterPool.length} creatures in pool
          </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAiEncounter}
            disabled={aiEncounterLoading}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-60"
          >
            {aiEncounterLoading ? "Generating..." : "Generate Encounter (AI)"}
          </button>
          {aiEncounterProvider && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              {aiEncounterProvider}
            </span>
          )}
        </div>
        {aiEncounterError && <p className="text-xs text-ember">{aiEncounterError}</p>}
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip" data-tooltip="Deterministic table output from terrain and tags.">
            Markdown Output
          </div>
          <textarea
            value={encounterMarkdown}
            readOnly
            rows={8}
            className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </div>
        {aiEncounterResult && (
          <div>
            <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip" data-tooltip="AI-generated encounter notes.">
              AI Encounter Output
            </div>
            <textarea
              value={aiEncounterResult}
              readOnly
              rows={8}
              className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
            />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={activeModal === "involved"}
        title="Who's Involved"
        onClose={() => setActiveModal(null)}
      >
        <p className="text-xs text-ink-soft">
          Requires type tags (npc/faction/organization/monster) and links/backlinks to
          determine involved actors.
        </p>
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Markdown Output
          </div>
          <textarea
            value={involvedMarkdown}
            readOnly
            rows={8}
            className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === "recent"}
        title="What Changed Recently"
        onClose={() => setActiveModal(null)}
      >
        <p className="text-xs text-ink-soft">
          Uses updated timestamps and optional change_summary frontmatter for summaries.
        </p>
        <label className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
          Since Date
          <input
            type="date"
            value={since}
            onChange={(event) => onSinceChange(event.target.value)}
            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
          />
        </label>
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Markdown Output
          </div>
          <textarea
            value={recentMarkdown}
            readOnly
            rows={8}
            className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === "initiative"}
        title="Initiative Tracker"
        onClose={() => setActiveModal(null)}
      >
        <p className="text-xs text-ink-soft">
          Provide players and monsters with rolls or dex modifiers. Seeded rolls keep results
          deterministic.
        </p>
        <label className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
          Combatants JSON
          <textarea
            value={initiativePayload}
            onChange={(event) => setInitiativePayload(event.target.value)}
            rows={6}
            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={initiativeSeed}
            onChange={(event) => setInitiativeSeed(event.target.value)}
            className="flex-1 rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            placeholder="Seed (optional)"
          />
          <button
            onClick={handleInitiativeRun}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
          >
            Run
          </button>
        </div>
        {initiativeError && <p className="text-xs text-ember">{initiativeError}</p>}
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Markdown Output
          </div>
          <textarea
            value={initiativeMarkdown}
            readOnly
            rows={8}
            className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === "treasure"}
        title="Treasure Suggestion"
        onClose={() => setActiveModal(null)}
      >
        <p className="text-xs text-ink-soft">
          Uses CR-based treasure tables. Individual rolls per monster or a single hoard roll.
        </p>
        <label className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
          Monsters JSON
          <textarea
            value={treasurePayload}
            onChange={(event) => setTreasurePayload(event.target.value)}
            rows={6}
            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </label>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            value={treasureSeed}
            onChange={(event) => setTreasureSeed(event.target.value)}
            className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
            placeholder="Seed (optional)"
          />
          <select
            value={lootType}
            onChange={(event) =>
              setLootType(event.target.value as "individual" | "hoard")
            }
            className="rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
          >
            <option value="individual">Individual</option>
            <option value="hoard">Hoard</option>
          </select>
          <button
            onClick={handleTreasureRun}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
          >
            Run
          </button>
        </div>
        {treasureError && <p className="text-xs text-ember">{treasureError}</p>}
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
            Markdown Output
          </div>
          <textarea
            value={treasureMarkdown}
            readOnly
            rows={8}
            className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-[11px] font-mono"
          />
        </div>
      </Modal>
    </>
  );
}
