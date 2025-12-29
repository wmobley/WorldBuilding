import type { LootResult } from "../lib/loot";
import { generateLoot } from "../lib/loot";
import { createSeededRng } from "../lib/random";

export type TreasureMonster = {
  name: string;
  cr: number;
};

export type TreasureSuggestion = {
  coins: Record<string, number>;
  valuables: string[];
  items: string[];
  explain: Array<{ step: string; detail: string }>;
  inputsUsed: {
    lootType: "individual" | "hoard";
    crs: number[];
    seed: string | number | null;
  };
  warnings: string[];
};

type LootDataInput = Parameters<typeof generateLoot>[0];

const coinPattern = /^(\S+)\s+([a-zA-Z]+)$/;

function rollDice(expression: string, rng: () => number) {
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

function sumCoins(coinLines: string[], rng: () => number) {
  const totals: Record<string, number> = {};
  for (const line of coinLines) {
    const match = line.trim().match(coinPattern);
    if (!match) continue;
    const amount = rollDice(match[1], rng);
    const coin = match[2].toLowerCase();
    totals[coin] = (totals[coin] ?? 0) + amount;
  }
  return totals;
}

export function buildTreasureSuggestion({
  monsters,
  lootType,
  lootData,
  seed
}: {
  monsters: TreasureMonster[];
  lootType: "individual" | "hoard";
  lootData: LootDataInput;
  seed?: string | number;
}): TreasureSuggestion {
  const warnings: string[] = [];
  const rng =
    seed == null
      ? () => Math.random()
      : createSeededRng(seed);

  if (monsters.length === 0) {
    warnings.push("No monsters provided; returning empty treasure.");
  }

  const crs = monsters.map((monster) => monster.cr);
  const valuables: string[] = [];
  const items: string[] = [];
  const coinLines: string[] = [];
  const explain: Array<{ step: string; detail: string }> = [];

  if (lootType === "individual") {
    monsters.forEach((monster) => {
      const loot = generateLoot(lootData, monster.cr, "individual", rng);
      if (!loot) return;
      coinLines.push(...loot.coins);
      valuables.push(...loot.valuables);
      items.push(...loot.magicItems);
    });
    explain.push({
      step: "roll",
      detail: `Rolled individual treasure for ${monsters.length} monster(s).`
    });
  } else {
    const maxCr = crs.length > 0 ? Math.max(...crs) : 0;
    const loot = generateLoot(lootData, maxCr, "hoard", rng);
    if (loot) {
      coinLines.push(...loot.coins);
      valuables.push(...loot.valuables);
      items.push(...loot.magicItems);
    }
    explain.push({
      step: "roll",
      detail: `Rolled hoard treasure for CR ${maxCr}.`
    });
  }

  if (seed == null) {
    warnings.push("No seed provided; treasure rolls are non-deterministic.");
  }

  return {
    coins: sumCoins(coinLines, rng),
    valuables,
    items,
    explain,
    inputsUsed: {
      lootType,
      crs,
      seed: seed ?? null
    },
    warnings
  };
}
