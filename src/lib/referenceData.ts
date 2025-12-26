export type ReferenceItem = {
  slug: string;
  label: string;
  category: "dungeon-master" | "references";
};

export const referenceItems: ReferenceItem[] = [
  { slug: "dm-screen", label: "DM Screen", category: "dungeon-master" },
  { slug: "adventures", label: "Adventures", category: "dungeon-master" },
  { slug: "cults-boons", label: "Cults & Supernatural Boons", category: "dungeon-master" },
  { slug: "objects", label: "Objects", category: "dungeon-master" },
  { slug: "traps-hazards", label: "Traps & Hazards", category: "dungeon-master" },
  { slug: "cr-calculator", label: "CR Calculator", category: "dungeon-master" },
  { slug: "encounter-generator", label: "Encounter Generator", category: "dungeon-master" },
  { slug: "loot-generator", label: "Loot Generator", category: "dungeon-master" },
  { slug: "actions", label: "Actions", category: "references" },
  { slug: "bastions", label: "Bastions", category: "references" },
  { slug: "bestiary", label: "Bestiary", category: "references" },
  { slug: "conditions-diseases", label: "Conditions & Diseases", category: "references" },
  { slug: "decks", label: "Decks", category: "references" },
  { slug: "deities", label: "Deities", category: "references" },
  { slug: "items", label: "Items", category: "references" },
  { slug: "languages", label: "Languages", category: "references" },
  { slug: "rewards", label: "Supernatural Gifts & Rewards", category: "references" },
  { slug: "psionics", label: "Psionics", category: "references" },
  { slug: "spells", label: "Spells", category: "references" },
  { slug: "vehicles", label: "Vehicles", category: "references" },
  { slug: "recipes", label: "Recipes", category: "references" },
  { slug: "imports-foundry", label: "Imports: Foundry", category: "references" },
  { slug: "imports-5etools", label: "Imports: 5e.tools", category: "references" }
];

export const dmItems = referenceItems.filter((item) => item.category === "dungeon-master");
export const referenceShelf = referenceItems.filter((item) => item.category === "references");
