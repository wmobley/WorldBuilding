export type TagNamespaceSpec = {
  namespace: string;
  kind: "closed" | "open" | "semi";
  values?: string[];
  description: string;
  usedBy: string[];
  pattern?: string;
};

export const tagVocabulary: TagNamespaceSpec[] = [
  {
    namespace: "type",
    kind: "closed",
    values: [
      "location",
      "region",
      "settlement",
      "dungeon",
      "landmark",
      "npc",
      "faction",
      "organization",
      "party",
      "pc",
      "monster",
      "encounter",
      "quest",
      "item",
      "spell",
      "table",
      "downtime-hook",
      "rumor",
      "event",
      "session-note"
    ],
    description: "Note classification for deterministic helpers.",
    usedBy: [
      "Suggest Encounter",
      "Who's Involved",
      "What Changed Recently",
      "Initiative Setup",
      "Treasure Suggestion",
      "Downtime Hooks"
    ]
  },
  {
    namespace: "status",
    kind: "closed",
    values: [
      "active",
      "inactive",
      "planned",
      "resolved",
      "archived",
      "alive",
      "dead",
      "missing",
      "unknown"
    ],
    description: "Dashboards and filtering for activity and life state.",
    usedBy: ["Who's Involved", "What Changed Recently", "Quest / session tools"]
  },
  {
    namespace: "visibility",
    kind: "closed",
    values: ["public", "restricted", "secret", "meta"],
    description: "Public-facing vs DM-only content.",
    usedBy: ["What Changed Recently", "Who's Involved"]
  },
  {
    namespace: "location",
    kind: "open",
    description: "Canonical slug for where this is relevant.",
    usedBy: ["Suggest Encounter", "Who's Involved", "What Changed Recently", "Downtime Hooks"]
  },
  {
    namespace: "terrain",
    kind: "semi",
    values: [
      "arctic",
      "coastal",
      "desert",
      "forest",
      "grassland",
      "hills",
      "jungle",
      "mountains",
      "swamp",
      "underdark",
      "underwater",
      "urban"
    ],
    description: "Starter terrain list with DM extensions.",
    usedBy: ["Suggest Encounter"]
  },
  {
    namespace: "travel",
    kind: "closed",
    values: ["road", "wilderness", "sea", "river", "underground", "air"],
    description: "Travel mode weighting for encounter selection.",
    usedBy: ["Suggest Encounter"]
  },
  {
    namespace: "faction",
    kind: "open",
    description: "Faction slug.",
    usedBy: ["Suggest Encounter", "Who's Involved", "Downtime Hooks"]
  },
  {
    namespace: "role",
    kind: "open",
    description: "NPC role.",
    usedBy: ["Who's Involved"]
  },
  {
    namespace: "theme",
    kind: "open",
    description: "Encounter and downtime flavoring.",
    usedBy: ["Suggest Encounter", "Treasure Suggestion", "Downtime Hooks"]
  },
  {
    namespace: "tone",
    kind: "closed",
    values: ["grim", "heroic", "cozy", "weird", "dark-fantasy", "sword-and-sorcery"],
    description: "Mood filtering for encounters and downtime.",
    usedBy: ["Suggest Encounter", "Downtime Hooks"]
  },
  {
    namespace: "encounter_type",
    kind: "closed",
    values: ["combat", "social", "exploration", "hazard", "puzzle"],
    description: "Encounter kind.",
    usedBy: ["Suggest Encounter"]
  },
  {
    namespace: "difficulty",
    kind: "closed",
    values: ["trivial", "easy", "medium", "hard", "deadly"],
    description: "Encounter difficulty.",
    usedBy: ["Suggest Encounter"]
  },
  {
    namespace: "time",
    kind: "closed",
    values: ["day", "night", "dawn", "dusk"],
    description: "Time of day weighting for encounters.",
    usedBy: ["Suggest Encounter"]
  },
  {
    namespace: "frequency",
    kind: "closed",
    values: ["common", "uncommon", "rare"],
    description: "Table selection weighting.",
    usedBy: ["Table selection weighting"]
  },
  {
    namespace: "source",
    kind: "closed",
    values: ["srd", "homebrew"],
    description: "Content source for filtering and import/export.",
    usedBy: ["SRD-only filtering", "Import/Export metadata"]
  },
  {
    namespace: "creature_type",
    kind: "closed",
    values: [
      "aberration",
      "beast",
      "celestial",
      "construct",
      "dragon",
      "elemental",
      "fey",
      "fiend",
      "giant",
      "humanoid",
      "monstrosity",
      "ooze",
      "plant",
      "undead"
    ],
    description: "Creature type buckets.",
    usedBy: ["Suggest Encounter", "Treasure Suggestion"]
  },
  {
    namespace: "cr",
    kind: "closed",
    values: ["0-1", "2-4", "5-10", "11-16", "17-20", "21+"],
    description: "Challenge rating buckets.",
    usedBy: ["Suggest Encounter", "Treasure Suggestion"]
  },
  {
    namespace: "rarity",
    kind: "closed",
    values: ["common", "uncommon", "rare", "very-rare", "legendary", "artifact"],
    description: "Loot rarity.",
    usedBy: ["Treasure Suggestion"]
  },
  {
    namespace: "loot_type",
    kind: "closed",
    values: ["none", "individual", "hoard", "quest"],
    description: "Loot type.",
    usedBy: ["Treasure Suggestion"]
  },
  {
    namespace: "quest_type",
    kind: "closed",
    values: ["main", "side", "faction", "personal", "job", "mystery"],
    description: "Quest classification.",
    usedBy: ["Who's Involved", "What Changed Recently"]
  },
  {
    namespace: "session",
    kind: "open",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Session identifier in YYYY-MM-DD format.",
    usedBy: ["Session tools", "What Changed Recently"]
  },
  {
    namespace: "impact",
    kind: "closed",
    values: ["minor", "moderate", "major", "catastrophic"],
    description: "Change tracking impact rating.",
    usedBy: ["What Changed Recently"]
  },
  {
    namespace: "downtime",
    kind: "closed",
    values: [
      "carousing",
      "crafting",
      "research",
      "training",
      "work",
      "gambling",
      "crime",
      "religion",
      "travel",
      "rest"
    ],
    description: "Downtime hook categorization.",
    usedBy: ["Downtime Hooks"]
  },
  {
    namespace: "background",
    kind: "open",
    description: "Character background tags for downtime hooks.",
    usedBy: ["Downtime Hooks"]
  }
];
