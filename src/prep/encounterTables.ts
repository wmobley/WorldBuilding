import arctic from "../data/worldbuilder_tables_with_cr_and_travel/arctic_encounters_d100.table.json";
import coastal from "../data/worldbuilder_tables_with_cr_and_travel/coastal_encounters_d100.table.json";
import desert from "../data/worldbuilder_tables_with_cr_and_travel/desert_encounters_d100.table.json";
import forest from "../data/worldbuilder_tables_with_cr_and_travel/forest_encounters_d100.table.json";
import jungle from "../data/worldbuilder_tables_with_cr_and_travel/jungle_encounters_d100.table.json";
import mountain from "../data/worldbuilder_tables_with_cr_and_travel/mountain_encounters_d100.table.json";
import swamp from "../data/worldbuilder_tables_with_cr_and_travel/swamp_encounters_d100.table.json";
import underdark from "../data/worldbuilder_tables_with_cr_and_travel/underdark_encounters_d100.table.json";
import underwater from "../data/worldbuilder_tables_with_cr_and_travel/underwater_encounters_d100.table.json";
import urban from "../data/worldbuilder_tables_with_cr_and_travel/urban_encounters_d100.table.json";
import travelAir from "../data/worldbuilder_tables_with_cr_and_travel/travel_air_d100.table.json";
import travelRiver from "../data/worldbuilder_tables_with_cr_and_travel/travel_river_d100.table.json";
import travelRoad from "../data/worldbuilder_tables_with_cr_and_travel/travel_road_d100.table.json";
import travelSea from "../data/worldbuilder_tables_with_cr_and_travel/travel_sea_d100.table.json";
import travelUnderground from "../data/worldbuilder_tables_with_cr_and_travel/travel_underground_d100.table.json";

export type EncounterMonsterSuggestion = {
  name: string;
  count: string;
  source: string;
  notes?: string;
};

export type EncounterTableEntry = {
  range: [number, number];
  text: string;
  encounter_type?: string;
  cr_bucket: string;
  monster_suggestions?: EncounterMonsterSuggestion[];
  needs_homebrew?: boolean;
  notes?: string;
};

export type EncounterTable = {
  id: string;
  title: string;
  selectors: Record<string, string>;
  entries: EncounterTableEntry[];
};

type TableMatch = {
  table: EncounterTable;
  selectorType: "terrain" | "travel";
  selectorValue: string;
};

const terrainTables = new Map<string, EncounterTable>([
  ["arctic", arctic as EncounterTable],
  ["coastal", coastal as EncounterTable],
  ["desert", desert as EncounterTable],
  ["forest", forest as EncounterTable],
  ["jungle", jungle as EncounterTable],
  ["mountains", mountain as EncounterTable],
  ["swamp", swamp as EncounterTable],
  ["underdark", underdark as EncounterTable],
  ["underwater", underwater as EncounterTable],
  ["urban", urban as EncounterTable]
]);

const travelTables = new Map<string, EncounterTable>([
  ["road", travelRoad as EncounterTable],
  ["sea", travelSea as EncounterTable],
  ["river", travelRiver as EncounterTable],
  ["underground", travelUnderground as EncounterTable],
  ["air", travelAir as EncounterTable]
]);

export function getEncounterTables() {
  return { terrainTables, travelTables };
}

export function resolveEncounterTable({
  terrainTags,
  travelTags,
  rng
}: {
  terrainTags: string[];
  travelTags: string[];
  rng: () => number;
}): TableMatch | null {
  const travelOptions = travelTags
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag !== "wilderness" && travelTables.has(tag));
  if (travelOptions.length > 0) {
    const pick = travelOptions[Math.floor(rng() * travelOptions.length)];
    const table = travelTables.get(pick);
    if (table) return { table, selectorType: "travel", selectorValue: pick };
  }

  const terrainOptions = terrainTags
    .map((tag) => tag.toLowerCase())
    .filter((tag) => terrainTables.has(tag));
  if (terrainOptions.length > 0) {
    const pick = terrainOptions[Math.floor(rng() * terrainOptions.length)];
    const table = terrainTables.get(pick);
    if (table) return { table, selectorType: "terrain", selectorValue: pick };
  }

  const fallback = terrainTables.get("forest");
  return fallback ? { table: fallback, selectorType: "terrain", selectorValue: "forest" } : null;
}
