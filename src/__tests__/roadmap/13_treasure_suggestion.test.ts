import { describe, expect, it } from "vitest";
import { buildTreasureSuggestion } from "../../prep/treasure";

describe("roadmap/13 treasure suggestion", () => {
  it("rolls individual loot per monster deterministically with a seed", () => {
    const lootData = {
      individual: [
        {
          crMin: 0,
          crMax: 4,
          table: [{ min: 1, max: 100, coins: { sp: "2", gp: "1" } }]
        }
      ],
      hoard: [],
      gems: [],
      artObjects: [],
      magicItems: []
    };

    const result = buildTreasureSuggestion({
      monsters: [
        { name: "Goblin", cr: 0.25 },
        { name: "Goblin Boss", cr: 1 }
      ],
      lootType: "individual",
      lootData,
      seed: "goblin-loot"
    });

    expect(result.coins).toEqual({ sp: 4, gp: 2 });
    expect(result.warnings).toEqual([]);
  });

  it("rolls hoard loot using max CR", () => {
    const lootData = {
      individual: [],
      hoard: [
        {
          crMin: 0,
          crMax: 4,
          table: [{ min: 1, max: 100, coins: { gp: "10" } }],
          gems: [{ type: "10", qty: "1" }]
        }
      ],
      gems: [{ type: "10", table: ["10 gp gem"] }],
      artObjects: [],
      magicItems: []
    };

    const result = buildTreasureSuggestion({
      monsters: [{ name: "Ogre", cr: 2 }],
      lootType: "hoard",
      lootData,
      seed: "hoard"
    });

    expect(result.coins.gp).toBe(10);
    expect(result.valuables).toEqual(["10 gp gem"]);
  });
});
