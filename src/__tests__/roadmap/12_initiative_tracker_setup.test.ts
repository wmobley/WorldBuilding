import { describe, expect, it } from "vitest";
import { buildInitiativeOrder } from "../../prep/initiative";

describe("roadmap/12 initiative tracker setup", () => {
  it("builds a deterministic initiative order with seeded rolls", () => {
    const result = buildInitiativeOrder({
      players: [
        { name: "Aria", initiativeRoll: 15 },
        { name: "Borin", initiativeRoll: 8 }
      ],
      monsters: [
        { name: "Goblin Boss", dexMod: 2 },
        { name: "Goblin", dexMod: 2, count: 2 }
      ],
      seed: "goblin"
    });

    expect(result.initiativeOrder.map((entry) => entry.name)).toEqual([
      "Goblin #1",
      "Aria",
      "Goblin #2",
      "Borin",
      "Goblin Boss"
    ]);
    expect(result.initiativeOrder[0]?.initiative).toBe(16);
    expect(result.warnings).toEqual([]);
    expect(result.explain[0]?.detail).toContain("provided roll");
  });

  it("breaks ties by dex modifier then name", () => {
    const result = buildInitiativeOrder({
      players: [
        { name: "Aria", initiativeRoll: 12, dexMod: 3 },
        { name: "Borin", initiativeRoll: 12, dexMod: 1 }
      ],
      monsters: []
    });

    expect(result.initiativeOrder.map((entry) => entry.name)).toEqual([
      "Aria",
      "Borin"
    ]);
  });
});
