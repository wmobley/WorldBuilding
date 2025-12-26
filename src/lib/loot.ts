type LootTable = {
  name?: string;
  crMin?: number;
  crMax?: number;
  table?: Array<{ min: number; max: number; coins?: Record<string, string> }>;
  magicItems?: Array<{ table?: string; qty?: string }>;
  gems?: Array<{ type?: string; qty?: string }>;
  artObjects?: Array<{ type?: string; qty?: string }>;
};

type LootData = {
  individual: LootTable[];
  hoard: LootTable[];
  gems: Array<{ type: string; table: Array<{ min: number; max: number; item: string }> }>;
  artObjects: Array<{ type: string; table: Array<{ min: number; max: number; item: string }> }>;
  magicItems: Array<{ table: string; tableName?: string; dice?: string; items: string[] }>;
};

export type LootResult = {
  coins: string[];
  valuables: string[];
  magicItems: string[];
};

export function generateLoot(loot: LootData, cr: number, mode: "individual" | "hoard") {
  const tables = mode === "individual" ? loot.individual : loot.hoard;
  const table =
    tables.find((entry) => cr >= (entry.crMin ?? 0) && cr <= (entry.crMax ?? 100)) ??
    tables[0];
  if (!table) return null;
  const roll = rollDice("1d100");
  const row = (table.table ?? []).find((entry) => roll >= entry.min && roll <= entry.max);
  const result: LootResult = { coins: [], valuables: [], magicItems: [] };
  if (row?.coins) {
    result.coins = Object.entries(row.coins).map(([coin, value]) => `${value} ${coin}`);
  }
  if (mode === "hoard") {
    (table.gems ?? []).forEach((entry) => {
      const list = drawValuables(loot.gems, entry.type, entry.qty);
      result.valuables.push(...list);
    });
    (table.artObjects ?? []).forEach((entry) => {
      const list = drawValuables(loot.artObjects, entry.type, entry.qty);
      result.valuables.push(...list);
    });
    (table.magicItems ?? []).forEach((entry) => {
      const items = drawMagicItems(loot.magicItems, entry.table, entry.qty);
      result.magicItems.push(...items);
    });
  }
  return result;
}

function drawValuables(
  tables: Array<{ type: string; table: Array<{ min: number; max: number; item: string }> }>,
  type = "",
  qty = ""
) {
  const total = rollDice(qty || "1");
  const table = tables.find((entry) => entry.type === type);
  if (!table) return [];
  const results: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const roll = rollDice("1d100");
    const row = table.table.find((entry) => roll >= entry.min && roll <= entry.max);
    if (row?.item) results.push(row.item);
  }
  return results;
}

function drawMagicItems(
  tables: Array<{ table: string; tableName?: string; dice?: string; items: string[] }>,
  tableName = "",
  qty = ""
) {
  const total = rollDice(qty || "1");
  const table = tables.find((entry) => entry.table === tableName);
  if (!table) return [];
  const results: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const roll = rollDice("1d100");
    const index = Math.min(Math.max(Math.floor((roll - 1) / 100 * table.items.length), 0), table.items.length - 1);
    const item = table.items[index];
    if (item) results.push(item);
  }
  return results;
}

function rollDice(expression: string) {
  const match = expression.match(/(\\d+)d(\\d+)(?:\\s*[+\\-]\\s*\\d+)?/i);
  if (!match) return Number(expression) || 0;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifierMatch = expression.match(/[+\\-]\\s*(\\d+)/);
  const modifier = modifierMatch ? Number(modifierMatch[0].replace(/\s/g, "")) : 0;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total + modifier;
}
