type CrBand = {
  cr: string;
  crValue: number;
  hpMin: number;
  hpMax: number;
  dprMin: number;
  dprMax: number;
  ac: number;
  attack: number;
  dc: number;
};

const CR_TABLE: CrBand[] = [
  { cr: "0", crValue: 0, hpMin: 1, hpMax: 6, dprMin: 0, dprMax: 1, ac: 13, attack: 3, dc: 13 },
  { cr: "1/8", crValue: 0.125, hpMin: 7, hpMax: 35, dprMin: 2, dprMax: 3, ac: 13, attack: 3, dc: 13 },
  { cr: "1/4", crValue: 0.25, hpMin: 36, hpMax: 49, dprMin: 4, dprMax: 5, ac: 13, attack: 3, dc: 13 },
  { cr: "1/2", crValue: 0.5, hpMin: 50, hpMax: 70, dprMin: 6, dprMax: 8, ac: 13, attack: 3, dc: 13 },
  { cr: "1", crValue: 1, hpMin: 71, hpMax: 85, dprMin: 9, dprMax: 14, ac: 13, attack: 3, dc: 13 },
  { cr: "2", crValue: 2, hpMin: 86, hpMax: 100, dprMin: 15, dprMax: 20, ac: 13, attack: 3, dc: 13 },
  { cr: "3", crValue: 3, hpMin: 101, hpMax: 115, dprMin: 21, dprMax: 26, ac: 13, attack: 4, dc: 13 },
  { cr: "4", crValue: 4, hpMin: 116, hpMax: 130, dprMin: 27, dprMax: 32, ac: 14, attack: 5, dc: 14 },
  { cr: "5", crValue: 5, hpMin: 131, hpMax: 145, dprMin: 33, dprMax: 38, ac: 15, attack: 6, dc: 15 },
  { cr: "6", crValue: 6, hpMin: 146, hpMax: 160, dprMin: 39, dprMax: 44, ac: 15, attack: 6, dc: 15 },
  { cr: "7", crValue: 7, hpMin: 161, hpMax: 175, dprMin: 45, dprMax: 50, ac: 15, attack: 6, dc: 15 },
  { cr: "8", crValue: 8, hpMin: 176, hpMax: 190, dprMin: 51, dprMax: 56, ac: 16, attack: 7, dc: 16 },
  { cr: "9", crValue: 9, hpMin: 191, hpMax: 205, dprMin: 57, dprMax: 62, ac: 16, attack: 7, dc: 16 },
  { cr: "10", crValue: 10, hpMin: 206, hpMax: 220, dprMin: 63, dprMax: 68, ac: 17, attack: 7, dc: 16 },
  { cr: "11", crValue: 11, hpMin: 221, hpMax: 235, dprMin: 69, dprMax: 74, ac: 17, attack: 8, dc: 17 },
  { cr: "12", crValue: 12, hpMin: 236, hpMax: 250, dprMin: 75, dprMax: 80, ac: 17, attack: 8, dc: 17 },
  { cr: "13", crValue: 13, hpMin: 251, hpMax: 265, dprMin: 81, dprMax: 86, ac: 18, attack: 8, dc: 18 },
  { cr: "14", crValue: 14, hpMin: 266, hpMax: 280, dprMin: 87, dprMax: 92, ac: 18, attack: 8, dc: 18 },
  { cr: "15", crValue: 15, hpMin: 281, hpMax: 295, dprMin: 93, dprMax: 98, ac: 18, attack: 8, dc: 18 },
  { cr: "16", crValue: 16, hpMin: 296, hpMax: 310, dprMin: 99, dprMax: 104, ac: 18, attack: 9, dc: 18 },
  { cr: "17", crValue: 17, hpMin: 311, hpMax: 325, dprMin: 105, dprMax: 110, ac: 19, attack: 10, dc: 19 },
  { cr: "18", crValue: 18, hpMin: 326, hpMax: 340, dprMin: 111, dprMax: 116, ac: 19, attack: 10, dc: 19 },
  { cr: "19", crValue: 19, hpMin: 341, hpMax: 355, dprMin: 117, dprMax: 122, ac: 19, attack: 10, dc: 19 },
  { cr: "20", crValue: 20, hpMin: 356, hpMax: 400, dprMin: 123, dprMax: 140, ac: 19, attack: 10, dc: 19 },
  { cr: "21", crValue: 21, hpMin: 401, hpMax: 445, dprMin: 141, dprMax: 158, ac: 19, attack: 11, dc: 20 },
  { cr: "22", crValue: 22, hpMin: 446, hpMax: 490, dprMin: 159, dprMax: 176, ac: 19, attack: 11, dc: 20 },
  { cr: "23", crValue: 23, hpMin: 491, hpMax: 535, dprMin: 177, dprMax: 194, ac: 19, attack: 11, dc: 20 },
  { cr: "24", crValue: 24, hpMin: 536, hpMax: 580, dprMin: 195, dprMax: 212, ac: 19, attack: 12, dc: 21 },
  { cr: "25", crValue: 25, hpMin: 581, hpMax: 625, dprMin: 213, dprMax: 230, ac: 19, attack: 12, dc: 21 },
  { cr: "26", crValue: 26, hpMin: 626, hpMax: 670, dprMin: 231, dprMax: 248, ac: 19, attack: 12, dc: 21 },
  { cr: "27", crValue: 27, hpMin: 671, hpMax: 715, dprMin: 249, dprMax: 266, ac: 19, attack: 13, dc: 22 },
  { cr: "28", crValue: 28, hpMin: 716, hpMax: 760, dprMin: 267, dprMax: 284, ac: 19, attack: 13, dc: 22 },
  { cr: "29", crValue: 29, hpMin: 761, hpMax: 805, dprMin: 285, dprMax: 302, ac: 19, attack: 13, dc: 22 },
  { cr: "30", crValue: 30, hpMin: 806, hpMax: 850, dprMin: 303, dprMax: 320, ac: 19, attack: 14, dc: 23 }
];

export function calculateCr({
  hp,
  ac,
  dpr,
  attack,
  saveDc
}: {
  hp: number;
  ac: number;
  dpr: number;
  attack: number;
  saveDc: number;
}) {
  const defensive = getDefensiveCr(hp, ac);
  const offensive = getOffensiveCr(dpr, attack, saveDc);
  const average = (defensive.crValue + offensive.crValue) / 2;
  const final = CR_TABLE.reduce((closest, band) => {
    return Math.abs(band.crValue - average) < Math.abs(closest.crValue - average)
      ? band
      : closest;
  }, CR_TABLE[0]);
  return {
    defensive,
    offensive,
    final
  };
}

function getDefensiveCr(hp: number, ac: number) {
  const band = CR_TABLE.find((entry) => hp >= entry.hpMin && hp <= entry.hpMax) ?? CR_TABLE[0];
  const acAdjust = Math.floor((ac - band.ac) / 2);
  return adjustCr(band, acAdjust);
}

function getOffensiveCr(dpr: number, attack: number, saveDc: number) {
  const band = CR_TABLE.find((entry) => dpr >= entry.dprMin && dpr <= entry.dprMax) ?? CR_TABLE[0];
  const attackDiff = attack - band.attack;
  const dcDiff = saveDc - band.dc;
  const adjust = Math.floor(Math.max(attackDiff, dcDiff) / 2);
  return adjustCr(band, adjust);
}

function adjustCr(band: CrBand, delta: number) {
  const index = CR_TABLE.findIndex((entry) => entry.cr === band.cr);
  if (index === -1) return band;
  const target = Math.min(Math.max(index + delta, 0), CR_TABLE.length - 1);
  return CR_TABLE[target];
}
