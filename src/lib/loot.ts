type LootTable = {
  name?: string;
  crMin?: number;
  crMax?: number;
  table?: Array<{ min: number; max: number; coins?: Record<string, string | undefined> }>;
  magicItems?: Array<{ table?: string; qty?: string }>;
  gems?: Array<{ type?: string; qty?: string }>;
  artObjects?: Array<{ type?: string; qty?: string }>;
};

type LootData = {
  individual: LootTable[];
  hoard: LootTable[];
  gems: Array<{
    type: string | number;
    table: Array<{ min: number; max: number; item: string }> | string[];
  }>;
  artObjects: Array<{
    type: string | number;
    table: Array<{ min: number; max: number; item: string }> | string[];
  }>;
  magicItems: Array<
    | { table: string; tableName?: string; dice?: string; items: string[] }
    | {
        name?: string;
        source?: string;
        page?: number;
        type?: string;
        table: Array<{
          min: number;
          max: number;
          item?: string;
          choose?: {
            fromGroup?: string[];
            fromGeneric?: string[];
            fromMatching?: Record<string, string>;
          };
          spellLevel?: number;
        }>;
      }
  >;
};

export type LootResult = {
  coins: string[];
  valuables: string[];
  magicItems: string[];
};

export function generateLoot(
  loot: LootData,
  cr: number,
  mode: "individual" | "hoard",
  rng: () => number = Math.random
) {
  const tables = mode === "individual" ? loot.individual : loot.hoard;
  const table =
    tables.find((entry) => cr >= (entry.crMin ?? 0) && cr <= (entry.crMax ?? 100)) ??
    tables[0];
  if (!table) return null;
  const roll = rollDice("1d100", rng);
  const row = (table.table ?? []).find((entry) => roll >= entry.min && roll <= entry.max);
  const result: LootResult = { coins: [], valuables: [], magicItems: [] };
  if (row?.coins) {
    result.coins = Object.entries(row.coins).map(([coin, value]) => `${value} ${coin}`);
  }
  if (mode === "hoard") {
    (table.gems ?? []).forEach((entry) => {
      const list = drawValuables(loot.gems, entry.type, entry.qty, rng);
      result.valuables.push(...list);
    });
    (table.artObjects ?? []).forEach((entry) => {
      const list = drawValuables(loot.artObjects, entry.type, entry.qty, rng);
      result.valuables.push(...list);
    });
    (table.magicItems ?? []).forEach((entry) => {
      const items = drawMagicItems(loot.magicItems, entry.table, entry.qty, rng);
      result.magicItems.push(...items);
    });
  }
  return result;
}

function drawValuables(
  tables: Array<{
    type: string | number;
    table: Array<{ min: number; max: number; item: string }> | string[];
  }>,
  type = "",
  qty = "",
  rng: () => number = Math.random
) {
  const total = rollDice(qty || "1", rng);
  const table = tables.find((entry) => String(entry.type) === String(type));
  if (!table) return [];
  const results: string[] = [];
  if (table.table.length > 0 && typeof table.table[0] === "string") {
    for (let i = 0; i < total; i += 1) {
      const roll = rollDice("1d100", rng);
      const index = Math.min(
        Math.max(Math.floor((roll - 1) / 100 * table.table.length), 0),
        table.table.length - 1
      );
      const item = table.table[index] as string | undefined;
      if (item) results.push(item);
    }
    return results;
  }
  for (let i = 0; i < total; i += 1) {
    const roll = rollDice("1d100", rng);
    const row = (table.table as Array<{ min: number; max: number; item: string }>).find(
      (entry) => roll >= entry.min && roll <= entry.max
    );
    if (row?.item) results.push(row.item);
  }
  return results;
}

function drawMagicItems(
  tables: Array<
    | { table: string; tableName?: string; dice?: string; items: string[] }
    | {
        name?: string;
        source?: string;
        page?: number;
        type?: string;
        table: Array<{
          min: number;
          max: number;
          item?: string;
          choose?: {
            fromGroup?: string[];
            fromGeneric?: string[];
            fromMatching?: Record<string, string>;
          };
          spellLevel?: number;
        }>;
      }
  >,
  tableName = "",
  qty = "",
  rng: () => number = Math.random
) {
  const total = rollDice(qty || "1", rng);
  const table = tables.find((entry) => {
    if ("items" in entry) {
      return entry.table === tableName;
    }
    const name = entry.name ?? "";
    const type = entry.type ?? "";
    return (
      tableName === name ||
      tableName === `Magic Item Table ${type}` ||
      tableName.endsWith(` ${type}`)
    );
  });
  if (!table) return [];
  const results: string[] = [];
  for (let i = 0; i < total; i += 1) {
    if ("items" in table) {
      const roll = rollDice("1d100", rng);
      const index = Math.min(
        Math.max(Math.floor((roll - 1) / 100 * table.items.length), 0),
        table.items.length - 1
      );
      const item = table.items[index];
      if (item) results.push(item);
      continue;
    }
    const roll = rollDice("1d100", rng);
    const row = table.table.find((entry) => roll >= entry.min && roll <= entry.max);
    if (row?.item) {
      results.push(row.item);
      continue;
    }
    const choices = row?.choose?.fromGroup ?? row?.choose?.fromGeneric ?? [];
    if (choices.length > 0) {
      const choiceIndex = Math.floor(rng() * choices.length);
      const pick = choices[choiceIndex];
      if (pick) results.push(pick);
      continue;
    }
    const matching = row?.choose?.fromMatching;
    if (matching && Object.keys(matching).length > 0) {
      results.push(`Magic item matching ${JSON.stringify(matching)}`);
    }
  }
  return results;
}

function rollDice(expression: string, rng: () => number = Math.random) {
  const match = expression.match(/(\d+)d(\d+)(?:\s*[+\-]\s*\d+)?/i);
  if (!match) return Number(expression) || 0;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifierMatch = expression.match(/[+\-]\s*(\d+)/);
  const modifier = modifierMatch ? Number(modifierMatch[0].replace(/\s/g, "")) : 0;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += Math.floor(rng() * sides) + 1;
  }
  return total + modifier;
}
