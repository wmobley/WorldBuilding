type RollTerm =
  | { type: "number"; value: number; sign: number }
  | { type: "dice"; count: number; faces: number; rolls: number[]; sign: number };

const normalizeExpression = (raw: string) =>
  raw.toLowerCase().replace(/\s+/g, "").replace(/^\+/, "");

const parseTerms = (expression: string): RollTerm[] | null => {
  const terms: RollTerm[] = [];
  const regex = /([+-]?)(\d*d\d+|\d+)/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;

  while ((match = regex.exec(expression))) {
    if (match.index !== cursor) {
      return null;
    }
    cursor = match.index + match[0].length;
    const sign = match[1] === "-" ? -1 : 1;
    const token = match[2];
    if (token.includes("d")) {
      const [countRaw, facesRaw] = token.split("d");
      const count = countRaw ? Number(countRaw) : 1;
      const faces = Number(facesRaw);
      if (!Number.isFinite(count) || !Number.isFinite(faces) || faces <= 0 || count <= 0) {
        return null;
      }
      terms.push({ type: "dice", count, faces, rolls: [], sign });
    } else {
      const value = Number(token);
      if (!Number.isFinite(value)) return null;
      terms.push({ type: "number", value, sign });
    }
  }

  if (terms.length === 0 || cursor !== expression.length) return null;
  return terms;
};

const rollDie = (faces: number) => Math.floor(Math.random() * faces) + 1;

export const rollDiceExpression = (raw: string) => {
  const normalized = normalizeExpression(raw);
  const terms = parseTerms(normalized);
  if (!terms) return null;

  let total = 0;
  const parts: string[] = [];

  terms.forEach((term, index) => {
    const prefix = index === 0 && term.sign === 1 ? "" : term.sign === -1 ? " - " : " + ";
    if (term.type === "number") {
      total += term.sign * term.value;
      parts.push(`${prefix}${Math.abs(term.value)}`);
    } else {
      const rolls = Array.from({ length: term.count }, () => rollDie(term.faces));
      term.rolls = rolls;
      const sum = rolls.reduce((acc, val) => acc + val, 0);
      total += term.sign * sum;
      parts.push(`${prefix}${term.count}d${term.faces}(${rolls.join(",")})`);
    }
  });

  return {
    expression: normalized,
    total,
    breakdown: parts.join("")
  };
};
