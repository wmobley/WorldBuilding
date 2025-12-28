import type { Doc, Folder, ReferenceEntry, Tag } from "../vault/types";
import { classifyAnchorType } from "../pages/vault/utils";
import type { WorldContext } from "./context";

type EncounterMatch = {
  creatureTags: string[];
  ecosystemTags: string[];
};

export type EncounterSuggestion = {
  id: string;
  name: string;
  type: string;
  cr: string;
  source: string;
  environments: string[];
  match: EncounterMatch;
};

export type EncounterPrep = {
  logic: {
    creatureTags: string[];
    ecosystemTags: string[];
    matchRules: string[];
    sort: string;
    limit: number;
  };
  results: EncounterSuggestion[];
};

export type InvolvedEntry = {
  id: string;
  title: string;
  type: string;
  sources: string[];
};

export type InvolvedPrep = {
  logic: {
    sources: string[];
    includedTypes: string[];
    limit: number;
  };
  results: InvolvedEntry[];
};

export type RecentChange = {
  id: string;
  title: string;
  updatedAt: string;
  reason: string;
};

export type RecentPrep = {
  logic: {
    sources: string[];
    limit: number;
    ordering: string;
  };
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

function formatMonsterType(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const base = typeof record.type === "string" ? record.type : "—";
    if (Array.isArray(record.tags) && record.tags.length > 0) {
      return `${base} (${record.tags.join(", ")})`;
    }
    return base;
  }
  return "—";
}

function extractMonsterCandidate(entry: ReferenceEntry) {
  if (!entry.rawJson) return null;
  try {
    const data = JSON.parse(entry.rawJson) as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name : entry.name;
    const type = formatMonsterType(data.type);
    const cr =
      typeof data.cr === "string" || typeof data.cr === "number" ? String(data.cr) : "—";
    const source = typeof data.source === "string" ? data.source : entry.source;
    const environments = Array.isArray(data.environment)
      ? data.environment.map((env) => String(env))
      : typeof data.environment === "string"
        ? [data.environment]
        : [];
    return {
      id: entry.id,
      name,
      type,
      cr,
      source,
      environments
    };
  } catch {
    return null;
  }
}

function buildEncounterSuggestions(
  tags: Tag[],
  bestiaryReferences: ReferenceEntry[],
  limit = ENCOUNTER_LIMIT
): EncounterPrep {
  const creatureTags = uniqueStrings(
    tags.filter((tag) => tag.type === "creature").map((tag) => tag.value)
  );
  const ecosystemTags = uniqueStrings(
    tags.filter((tag) => tag.type === "ecosystem").map((tag) => tag.value)
  );
  const candidates = bestiaryReferences
    .map(extractMonsterCandidate)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const results = candidates
    .map((candidate) => {
      const creatureMatches = creatureTags.filter(
        (tag) => includesNormalized(candidate.name, tag) || includesNormalized(candidate.type, tag)
      );
      const ecosystemMatches = ecosystemTags.filter((tag) =>
        candidate.environments.some((env) => includesNormalized(env, tag))
      );
      const score = creatureMatches.length * 2 + ecosystemMatches.length;
      return {
        candidate,
        match: { creatureTags: creatureMatches, ecosystemTags: ecosystemMatches },
        score
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const nameCompare = a.candidate.name.localeCompare(b.candidate.name);
      if (nameCompare !== 0) return nameCompare;
      return a.candidate.id.localeCompare(b.candidate.id);
    })
    .slice(0, limit)
    .map(({ candidate, match }) => ({
      ...candidate,
      match
    }));

  return {
    logic: {
      creatureTags,
      ecosystemTags,
      matchRules: [
        "Creature tags match monster name or type.",
        "Ecosystem tags match monster environment.",
        "Scores use 2x creature matches plus 1x ecosystem matches."
      ],
      sort: "score desc, name asc",
      limit
    },
    results
  };
}

function buildWhosInvolved(
  linkedDocs: Doc[],
  backlinks: Doc[],
  folders: Folder[],
  limit = INVOLVED_LIMIT
): InvolvedPrep {
  const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));
  const allowedTypes = ["Faction", "Religion", "Figure"];
  const involvement = new Map<string, InvolvedEntry>();

  const addDoc = (doc: Doc, source: string) => {
    const type = classifyAnchorType(doc, folderMap);
    if (!allowedTypes.includes(type)) return;
    const existing = involvement.get(doc.id);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources = [...existing.sources, source].sort();
      }
      return;
    }
    involvement.set(doc.id, { id: doc.id, title: doc.title, type, sources: [source] });
  };

  linkedDocs.forEach((doc) => addDoc(doc, "linked"));
  backlinks.forEach((doc) => addDoc(doc, "backlink"));

  const results = Array.from(involvement.values())
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);

  return {
    logic: {
      sources: ["linkedDocs", "backlinks"],
      includedTypes: allowedTypes,
      limit
    },
    results
  };
}

function buildRecentChanges(
  currentDocId: string,
  linkedDocs: Doc[],
  backlinks: Doc[],
  recentlyUpdatedDocs: Doc[],
  limit = RECENT_LIMIT
): RecentPrep {
  const linkedIds = new Set([...linkedDocs, ...backlinks].map((doc) => doc.id));
  linkedIds.add(currentDocId);

  const related = recentlyUpdatedDocs.filter((doc) => linkedIds.has(doc.id));
  const others = recentlyUpdatedDocs.filter((doc) => !linkedIds.has(doc.id));

  const combined = [...related, ...others].slice(0, limit);
  const results = combined.map((doc) => {
    const reason =
      doc.id === currentDocId
        ? "currentDoc"
        : linkedDocs.some((entry) => entry.id === doc.id)
          ? "linked"
          : backlinks.some((entry) => entry.id === doc.id)
            ? "backlink"
            : "recentCampaignUpdate";
    return {
      id: doc.id,
      title: doc.title,
      updatedAt: new Date(doc.updatedAt).toISOString(),
      reason
    };
  });

  return {
    logic: {
      sources: ["recentlyUpdatedDocs", "linkedDocs", "backlinks"],
      limit,
      ordering: "updatedAt desc, related docs first"
    },
    results
  };
}

export function buildPrepHelpers({
  context,
  folders,
  bestiaryReferences
}: {
  context: WorldContext | null;
  folders: Folder[];
  bestiaryReferences: ReferenceEntry[];
}): PrepHelpers | null {
  if (!context) return null;
  return {
    suggestEncounter: buildEncounterSuggestions(
      context.currentDoc.tags,
      bestiaryReferences
    ),
    whosInvolved: buildWhosInvolved(context.linkedDocs, context.backlinks, folders),
    whatChangedRecently: buildRecentChanges(
      context.currentDoc.id,
      context.linkedDocs,
      context.backlinks,
      context.recentlyUpdatedDocs
    )
  };
}
