import { createSeededRng } from "../lib/random";

export type InitiativePlayer = {
  name: string;
  initiativeRoll?: number;
  dexMod?: number;
};

export type InitiativeMonster = {
  name: string;
  dexMod: number;
  count?: number;
  initiativeRoll?: number;
};

export type InitiativeEntry = {
  name: string;
  initiative: number;
  roll: number;
  dexMod: number;
  source: "provided" | "rolled";
  kind: "player" | "monster";
};

export type InitiativeOrder = {
  initiativeOrder: InitiativeEntry[];
  explain: Array<{ step: string; detail: string }>;
  warnings: string[];
};

const rollDie = (sides: number, rng: () => number) =>
  Math.floor(rng() * sides) + 1;

export function buildInitiativeOrder({
  players,
  monsters,
  seed
}: {
  players: InitiativePlayer[];
  monsters: InitiativeMonster[];
  seed?: string | number;
}): InitiativeOrder {
  const warnings: string[] = [];
  const rng =
    seed == null
      ? () => Math.random()
      : createSeededRng(seed);

  const entries: InitiativeEntry[] = [];
  let rolledCount = 0;
  let providedCount = 0;
  let reusedMonsterRolls = 0;

  players.forEach((player) => {
    const dexMod = player.dexMod ?? 0;
    const roll =
      typeof player.initiativeRoll === "number"
        ? player.initiativeRoll
        : rollDie(20, rng);
    const source = typeof player.initiativeRoll === "number" ? "provided" : "rolled";
    if (source === "rolled") rolledCount += 1;
    else providedCount += 1;
    entries.push({
      name: player.name,
      initiative: roll + dexMod,
      roll,
      dexMod,
      source,
      kind: "player"
    });
  });

  monsters.forEach((monster) => {
    const count = Math.max(1, monster.count ?? 1);
    if (count > 1 && typeof monster.initiativeRoll === "number") {
      reusedMonsterRolls += count;
    }
    for (let index = 0; index < count; index += 1) {
      const dexMod = monster.dexMod;
      const roll =
        typeof monster.initiativeRoll === "number"
          ? monster.initiativeRoll
          : rollDie(20, rng);
      const source =
        typeof monster.initiativeRoll === "number" ? "provided" : "rolled";
      if (source === "rolled") rolledCount += 1;
      else providedCount += 1;
      const suffix = count > 1 ? ` #${index + 1}` : "";
      entries.push({
        name: `${monster.name}${suffix}`,
        initiative: roll + dexMod,
        roll,
        dexMod,
        source,
        kind: "monster"
      });
    }
  });

  const sorted = entries.sort((a, b) => {
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    if (a.dexMod !== b.dexMod) return b.dexMod - a.dexMod;
    return a.name.localeCompare(b.name);
  });

  if (seed == null && rolledCount > 0) {
    warnings.push("No seed provided; initiative rolls are non-deterministic.");
  }
  if (entries.length === 0) {
    warnings.push("No combatants provided.");
  }
  if (reusedMonsterRolls > 1) {
    warnings.push("Shared initiative roll applied to multiple monsters.");
  }

  return {
    initiativeOrder: sorted,
    explain: [
      {
        step: "roll",
        detail: `Used ${providedCount} provided roll(s) and rolled ${rolledCount} initiative(s).`
      },
      {
        step: "sort",
        detail: "Sorted by initiative desc, dex mod desc, name asc."
      }
    ],
    warnings
  };
}
