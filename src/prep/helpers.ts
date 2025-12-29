import type { Doc, Folder, Tag } from "../vault/types";
import { classifyAnchorType } from "../pages/vault/utils";
import type { WorldContext } from "./context";
import { getEncounterBudget } from "../lib/encounter";
import { createSeededRng } from "../lib/random";
import {
  resolveEncounterTable,
  type EncounterMonsterSuggestion,
  type EncounterTableEntry
} from "./encounterTables";

type EncounterMatch = {
  creatureTypeTags: string[];
  terrainTags: string[];
  travelTags: string[];
  crBuckets: string[];
};

export type EncounterSuggestion = {
  id: string;
  tableId: string;
  tableTitle: string;
  roll: number;
  range: [number, number];
  text: string;
  encounterType: string;
  crBucket: string;
  monsterSuggestions: EncounterMonsterSuggestion[];
  needsHomebrew: boolean;
  match: EncounterMatch;
};

export type EncounterPrep = {
  logic: {
    creatureTypeTags: string[];
    terrainTags: string[];
    travelTags: string[];
    crTags: string[];
    crBuckets: string[];
    party: {
      size: number;
      level: number;
      difficulty: "easy" | "medium" | "hard" | "deadly";
    };
    matchRules: string[];
    selection: string;
    limit: number;
  };
  explain: Array<{ step: string; detail: string }>;
  inputsUsed: {
    tags: {
      creatureTypeTags: string[];
      terrainTags: string[];
      travelTags: string[];
      crTags: string[];
    };
    party: {
      size: number;
      level: number;
      difficulty: "easy" | "medium" | "hard" | "deadly";
    };
    table: {
      id: string;
      title: string;
      selectors: Record<string, string>;
    } | null;
  };
  encounterPlan: {
    budget: number;
    rolls: number[];
    crBuckets: string[];
  };
  warnings: string[];
  results: EncounterSuggestion[];
};

export type InvolvedEntry = {
  id: string;
  title: string;
  type: string;
  sources: string[];
  tags: string[];
};

export type InvolvedPrep = {
  logic: {
    sources: string[];
    includedTypes: string[];
    limit: number;
  };
  explain: Array<{ step: string; detail: string }>;
  inputsUsed: {
    linkedDocIds: string[];
    backlinkDocIds: string[];
    locationTaggedDocIds: string[];
    locationTags: string[];
    includedTypes: string[];
  };
  warnings: string[];
  results: InvolvedEntry[];
};

export type RecentChange = {
  id: string;
  title: string;
  updatedAt: string;
  reason: string;
  change: string | null;
};

export type RecentPrep = {
  logic: {
    sources: string[];
    limit: number;
    ordering: string;
  };
  explain: Array<{ step: string; detail: string }>;
  inputsUsed: {
    currentDocId: string;
    linkedDocIds: string[];
    backlinkDocIds: string[];
    locationTaggedDocIds: string[];
    since: string | null;
    recentDocIds: string[];
  };
  warnings: string[];
  results: RecentChange[];
};

export type PrepHelpers = {
  suggestEncounter: EncounterPrep;
  whosInvolved: InvolvedPrep;
  whatChangedRecently: RecentPrep;
};

const ENCOUNTER_LIMIT = 6;
const INVOLVED_LIMIT = 10;
const RECENT_LIMIT = 8;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const includesNormalized = (haystack: string, needle: string) => {
  const hay = normalize(haystack);
  const ned = normalize(needle);
  if (!hay || !ned) return false;
  return hay.includes(ned);
};

const stripFrontmatter = (body: string) => {
  if (!body.startsWith("---")) return body;
  const match = body.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? body.slice(match[0].length) : body;
};

const parseChangeSummary = (body: string) => {
  const frontmatterMatch = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatterMatch?.[1]) {
    const lines = frontmatterMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*change_summary\s*:\s*(.+)$/);
      if (match?.[1]) {
        return match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
  const content = stripFrontmatter(body);
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return null;
  return firstLine.replace(/^#{1,6}\s+/, "").trim() || null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const CR_BUCKETS = ["cr:0-1", "cr:2-4", "cr:5-10", "cr:11-16", "cr:17-20", "cr:21+"];

const CR_BUCKET_INDEX = new Map(CR_BUCKETS.map((bucket, index) => [bucket, index]));

const CR_BUCKET_BY_LEVEL = [
  { max: 1, bucket: "cr:0-1" },
  { max: 4, bucket: "cr:2-4" },
  { max: 10, bucket: "cr:5-10" },
  { max: 16, bucket: "cr:11-16" },
  { max: 20, bucket: "cr:17-20" }
];

const DIFFICULTY_SHIFT: Record<"easy" | "medium" | "hard" | "deadly", number> = {
  easy: -1,
  medium: 0,
  hard: 1,
  deadly: 2
};

const rollDie = (sides: number, rng: () => number) => Math.floor(rng() * sides) + 1;

const entryKey = (entry: EncounterTableEntry) =>
  `${entry.text}:${entry.range[0]}-${entry.range[1]}`;

const bucketForLevel = (level: number) => {
  for (const entry of CR_BUCKET_BY_LEVEL) {
    if (level <= entry.max) return entry.bucket;
  }
  return "cr:21+";
};

const resolveCrBuckets = ({
  crTags,
  partyLevel,
  difficulty
}: {
  crTags: string[];
  partyLevel: number;
  difficulty: "easy" | "medium" | "hard" | "deadly";
}) => {
  if (crTags.length > 0) return crTags.map((tag) => `cr:${tag}`);
  const baseBucket = bucketForLevel(partyLevel);
  const baseIndex = CR_BUCKET_INDEX.get(baseBucket) ?? 0;
  const shiftedIndex = clamp(baseIndex + DIFFICULTY_SHIFT[difficulty], 0, CR_BUCKETS.length - 1);
  const buckets = new Set([CR_BUCKETS[shiftedIndex], baseBucket]);
  return Array.from(buckets);
};

const entryMatchesCreatureTags = (entry: EncounterTableEntry, creatureTags: string[]) => {
  if (creatureTags.length === 0) return true;
  const textMatch = creatureTags.some((tag) => includesNormalized(entry.text, tag));
  if (textMatch) return true;
  const monsterNames = entry.monster_suggestions?.map((monster) => monster.name) ?? [];
  return creatureTags.some((tag) => monsterNames.some((name) => includesNormalized(name, tag)));
};

const entryMatchesBucket = (entry: EncounterTableEntry, buckets: string[]) =>
  buckets.length === 0 || buckets.includes(entry.cr_bucket);

function buildEncounterSuggestions({
  tags,
  party,
  seed,
  limit = ENCOUNTER_LIMIT
}: {
  tags: Tag[];
  party?: { size?: number; level?: number; difficulty?: "easy" | "medium" | "hard" | "deadly" };
  seed?: string;
  limit?: number;
}): EncounterPrep {
  const creatureTypeTags = uniqueStrings(
    tags
      .filter((tag) => ["creature_type", "creature"].includes(tag.type))
      .map((tag) => tag.value)
  );
  const terrainTags = uniqueStrings(
    tags.filter((tag) => ["terrain", "ecosystem"].includes(tag.type)).map((tag) => tag.value)
  );
  const travelTags = uniqueStrings(tags.filter((tag) => tag.type === "travel").map((tag) => tag.value));
  const crTags = uniqueStrings(tags.filter((tag) => tag.type === "cr").map((tag) => tag.value));
  const partySize = clamp(party?.size ?? 4, 1, 10);
  const partyLevel = clamp(party?.level ?? 3, 1, 20);
  const partyDifficulty = party?.difficulty ?? "medium";
  const rng = createSeededRng(seed ?? "encounter");
  const tableMatch = resolveEncounterTable({ terrainTags, travelTags, rng });
  const budget = getEncounterBudget({
    partySize,
    partyLevel,
    difficulty: partyDifficulty
  });
  const crBuckets = resolveCrBuckets({
    crTags,
    partyLevel,
    difficulty: partyDifficulty
  });

  const warnings: string[] = [];
  if (!tableMatch) {
    warnings.push("No encounter table could be selected.");
  }

  const table = tableMatch?.table ?? null;
  const entries = table?.entries ?? [];
  const bucketFiltered = entries.filter((entry) => entryMatchesBucket(entry, crBuckets));
  const creatureFiltered = bucketFiltered.filter((entry) =>
    entryMatchesCreatureTags(entry, creatureTypeTags)
  );

  const candidates =
    creatureTypeTags.length === 0
      ? bucketFiltered
      : creatureFiltered.length > 0
        ? creatureFiltered
        : bucketFiltered;

  if (creatureTypeTags.length > 0 && creatureFiltered.length === 0) {
    warnings.push("No encounters matched creature_type tags; showing full CR bucket.");
  }
  if (crTags.length > 0 && bucketFiltered.length === 0) {
    warnings.push("No encounters match CR bucket tags; showing full table.");
  }
  if (entries.length === 0) warnings.push("Selected encounter table has no entries.");

  const results: EncounterSuggestion[] = [];
  const rolls: number[] = [];
  const usedEntries = new Set<string>();
  const attemptsPerPick = 12;
  const maxPicks = Math.min(limit, entries.length || limit);

  for (let pickIndex = 0; pickIndex < maxPicks; pickIndex += 1) {
    let selected: EncounterTableEntry | null = null;
    let roll = 0;
    for (let attempt = 0; attempt < attemptsPerPick; attempt += 1) {
      roll = rollDie(100, rng);
      const entry = entries.find(
        (candidate) => roll >= candidate.range[0] && roll <= candidate.range[1]
      );
      if (!entry) continue;
      if (!entryMatchesBucket(entry, crBuckets) && bucketFiltered.length > 0) continue;
      if (!entryMatchesCreatureTags(entry, creatureTypeTags) && creatureTypeTags.length > 0) {
        continue;
      }
      if (usedEntries.has(entryKey(entry))) continue;
      selected = entry;
      break;
    }
    if (!selected) {
      if (candidates.length === 0) break;
      const fallback = candidates[Math.floor(rng() * candidates.length)];
      if (!fallback || usedEntries.has(entryKey(fallback))) continue;
      roll = rollDie(100, rng);
      selected = fallback;
      warnings.push("Encounter roll fell outside filtered entries; using fallback pick.");
    }
    if (!selected) continue;
    usedEntries.add(entryKey(selected));
    rolls.push(roll);
    results.push({
      id: `${table?.id ?? "table"}:${roll}:${entryKey(selected)}`,
      tableId: table?.id ?? "unknown",
      tableTitle: table?.title ?? "Unknown table",
      roll,
      range: selected.range,
      text: selected.text,
      encounterType: selected.encounter_type ?? table?.selectors?.encounter_type ?? "encounter",
      crBucket: selected.cr_bucket,
      monsterSuggestions: selected.monster_suggestions ?? [],
      needsHomebrew: selected.needs_homebrew ?? false,
      match: {
        creatureTypeTags,
        terrainTags,
        travelTags,
        crBuckets
      }
    });
  }

  if (results.some((entry) => entry.needsHomebrew)) {
    warnings.push("Some encounters require homebrew mapping.");
  }

  return {
    logic: {
      creatureTypeTags,
      terrainTags,
      travelTags,
      crTags,
      crBuckets,
      party: { size: partySize, level: partyLevel, difficulty: partyDifficulty },
      matchRules: [
        "Terrain or travel tags select the encounter table.",
        "CR tags filter encounter buckets; otherwise party level provides defaults.",
        "Creature-type tags narrow entries by text or monster suggestions.",
        "Roll d100 for each suggestion with filtered fallback."
      ],
      selection: tableMatch
        ? `${tableMatch.selectorType}:${tableMatch.selectorValue}`
        : "fallback",
      limit
    },
    explain: [
      {
        step: "table",
        detail: tableMatch
          ? `Selected ${tableMatch.table.title} from ${tableMatch.selectorType}:${tableMatch.selectorValue}.`
          : "No matching table found; using fallback."
      },
      {
        step: "filter",
        detail: `Filtered to ${crBuckets.length} CR bucket(s) and ${creatureTypeTags.length} creature-type tag(s).`
      },
      {
        step: "roll",
        detail: `Rolled d100 for ${results.length} encounter(s).`
      },
      {
        step: "budget",
        detail: `Budgeted ${budget} XP for ${partySize} level ${partyLevel} (${partyDifficulty}).`
      }
    ],
    inputsUsed: {
      tags: { creatureTypeTags, terrainTags, travelTags, crTags },
      party: { size: partySize, level: partyLevel, difficulty: partyDifficulty },
      table: table
        ? { id: table.id, title: table.title, selectors: table.selectors }
        : null
    },
    encounterPlan: {
      budget,
      rolls,
      crBuckets
    },
    warnings,
    results
  };
}

function formatTypeLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "npc") return "NPC";
  if (normalized === "pc") return "PC";
  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildWhosInvolved(
  linkedDocs: Doc[],
  backlinks: Doc[],
  folders: Folder[],
  docTagsById: Record<string, Tag[]>,
  locationTaggedDocs: Doc[],
  locationTags: string[],
  limit = INVOLVED_LIMIT
): InvolvedPrep {
  const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));
  const allowedTypes = ["NPC", "Faction", "Organization", "Monster", "Figure", "Religion"];
  const involvement = new Map<string, InvolvedEntry>();

  const addDoc = (doc: Doc, source: string) => {
    const tags = docTagsById[doc.id] ?? [];
    const typeTag = tags.find((tag) => tag.type === "type");
    const rawType = typeTag?.value ? formatTypeLabel(typeTag.value) : null;
    const fallbackType = classifyAnchorType(doc, folderMap);
    const type = rawType ?? fallbackType;
    if (!allowedTypes.includes(type)) return;
    const tagLabels = tags.map((tag) => `${tag.type}:${tag.value}`);
    const existing = involvement.get(doc.id);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources = [...existing.sources, source].sort();
      }
      return;
    }
    involvement.set(doc.id, {
      id: doc.id,
      title: doc.title,
      type,
      sources: [source],
      tags: tagLabels
    });
  };

  linkedDocs.forEach((doc) => addDoc(doc, "linked"));
  backlinks.forEach((doc) => addDoc(doc, "backlink"));
  locationTaggedDocs.forEach((doc) => addDoc(doc, "locationTag"));

  const results = Array.from(involvement.values())
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);

  return {
    logic: {
      sources: ["linkedDocs", "backlinks", "locationTags"],
      includedTypes: allowedTypes,
      limit
    },
    explain: [
      {
        step: "filter",
        detail: `Included linked docs (${linkedDocs.length}), backlinks (${backlinks.length}), and location tags (${locationTaggedDocs.length}).`
      },
      {
        step: "classify",
        detail: `Included types: ${allowedTypes.join(", ")}.`
      }
    ],
    inputsUsed: {
      linkedDocIds: linkedDocs.map((doc) => doc.id),
      backlinkDocIds: backlinks.map((doc) => doc.id),
      locationTaggedDocIds: locationTaggedDocs.map((doc) => doc.id),
      locationTags,
      includedTypes: allowedTypes
    },
    warnings: [
      ...(linkedDocs.length === 0 &&
      backlinks.length === 0 &&
      locationTaggedDocs.length === 0
        ? ["No linked, backlink, or location-tagged docs found."]
        : [])
    ],
    results
  };
}

function buildRecentChanges(
  currentDocId: string,
  linkedDocs: Doc[],
  backlinks: Doc[],
  recentlyUpdatedDocs: Doc[],
  locationTaggedDocs: Doc[],
  since?: string,
  limit = RECENT_LIMIT
): RecentPrep {
  const linkedIds = new Set(
    [...linkedDocs, ...backlinks, ...locationTaggedDocs].map((doc) => doc.id)
  );
  linkedIds.add(currentDocId);

  const sinceTimestamp = since ? Date.parse(since) : null;
  const validSince = sinceTimestamp != null && Number.isFinite(sinceTimestamp);
  const filteredBySince = validSince
    ? recentlyUpdatedDocs.filter((doc) => doc.updatedAt >= sinceTimestamp)
    : recentlyUpdatedDocs;
  const related = filteredBySince.filter((doc) => linkedIds.has(doc.id));
  const others = filteredBySince.filter((doc) => !linkedIds.has(doc.id));

  const combined = [...related, ...others].slice(0, limit);
  const results = combined.map((doc) => {
    const reason =
      doc.id === currentDocId
        ? "currentDoc"
        : linkedDocs.some((entry) => entry.id === doc.id)
          ? "linked"
          : backlinks.some((entry) => entry.id === doc.id)
            ? "backlink"
            : locationTaggedDocs.some((entry) => entry.id === doc.id)
              ? "locationTag"
              : "recentCampaignUpdate";
    return {
      id: doc.id,
      title: doc.title,
      updatedAt: new Date(doc.updatedAt).toISOString(),
      reason,
      change: parseChangeSummary(doc.body ?? "")
    };
  });

  return {
    logic: {
      sources: ["recentlyUpdatedDocs", "linkedDocs", "backlinks"],
      limit,
      ordering: "updatedAt desc, related docs first"
    },
    explain: [
      {
        step: "collect",
        detail: `Collected ${filteredBySince.length} recently updated docs.`
      },
      {
        step: "order",
        detail: `Prioritized related docs and sorted by recency${
          validSince ? ` since ${new Date(sinceTimestamp).toISOString()}` : ""
        }.`
      }
    ],
    inputsUsed: {
      currentDocId,
      linkedDocIds: linkedDocs.map((doc) => doc.id),
      backlinkDocIds: backlinks.map((doc) => doc.id),
      locationTaggedDocIds: locationTaggedDocs.map((doc) => doc.id),
      since: validSince ? new Date(sinceTimestamp).toISOString() : null,
      recentDocIds: filteredBySince.map((doc) => doc.id)
    },
    warnings: [
      ...(recentlyUpdatedDocs.length === 0 ? ["No recent updates available."] : []),
      ...(since && !validSince ? ["Invalid since timestamp; ignored."] : [])
    ],
    results
  };
}

export function buildPrepHelpers({
  context,
  folders,
  party,
  since,
  encounterSeed
}: {
  context: WorldContext | null;
  folders: Folder[];
  party?: { size?: number; level?: number; difficulty?: "easy" | "medium" | "hard" | "deadly" };
  since?: string;
  encounterSeed?: string;
}): PrepHelpers | null {
  if (!context) return null;
  return {
    suggestEncounter: buildEncounterSuggestions({
      tags: context.currentDoc.tags,
      party,
      seed: encounterSeed ?? context.currentDoc.id
    }),
    whosInvolved: buildWhosInvolved(
      context.linkedDocs,
      context.backlinks,
      folders,
      context.docTagsById ?? {},
      context.locationTaggedDocs ?? [],
      context.locationContextTags ?? []
    ),
    whatChangedRecently: buildRecentChanges(
      context.currentDoc.id,
      context.linkedDocs,
      context.backlinks,
      context.recentlyUpdatedDocs,
      context.locationTaggedDocs ?? [],
      since
    )
  };
}
