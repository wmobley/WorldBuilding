type MonsterEntry = {
  name?: string;
  entries?: unknown;
};

export type MonsterStatBlock = {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  hp: string;
  speed: string;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills: string;
  senses: string;
  languages: string;
  cr: string;
  traits: MonsterEntry[];
  actions: MonsterEntry[];
  bonusActions: MonsterEntry[];
  reactions: MonsterEntry[];
  legendaryActions: MonsterEntry[];
  mythicActions: MonsterEntry[];
};

export type MonsterSummary = {
  name: string;
  size: string;
  type: string;
  cr: string;
  ac: string;
  hp: string;
  source: string;
};

const sizeMap: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan"
};

const alignmentMap: Record<string, string> = {
  L: "lawful",
  N: "neutral",
  C: "chaotic",
  G: "good",
  E: "evil",
  U: "unaligned"
};

export function parseMonster(rawJson?: string) {
  if (!rawJson) return null;
  try {
    const data = JSON.parse(rawJson) as Record<string, unknown>;
    const name = String(data.name ?? "Unknown Creature");
    const size = formatSize(data.size);
    const type = formatType(data.type);
    const alignment = formatAlignment(data.alignment);
    const ac = formatAc(data.ac);
    const hp = formatHp(data.hp);
    const speed = formatSpeed(data.speed);
    const abilities = {
      str: Number(data.str ?? 0),
      dex: Number(data.dex ?? 0),
      con: Number(data.con ?? 0),
      int: Number(data.int ?? 0),
      wis: Number(data.wis ?? 0),
      cha: Number(data.cha ?? 0)
    };
    const skills = formatSkill(data.skill);
    const senses = formatSenses(data);
    const languages = Array.isArray(data.languages)
      ? data.languages.join(", ")
      : typeof data.languages === "string"
        ? data.languages
        : "—";
    const cr = typeof data.cr === "string" || typeof data.cr === "number" ? String(data.cr) : "—";

    return {
      name,
      size,
      type,
      alignment,
      ac,
      hp,
      speed,
      abilities,
      skills,
      senses,
      languages,
      cr,
      traits: normalizeEntries(data.trait),
      actions: normalizeEntries(data.action),
      bonusActions: normalizeEntries(data.bonus),
      reactions: normalizeEntries(data.reaction),
      legendaryActions: normalizeEntries(data.legendary),
      mythicActions: normalizeEntries(data.mythic)
    } satisfies MonsterStatBlock;
  } catch {
    return null;
  }
}

export function summarizeMonster(rawJson?: string): MonsterSummary | null {
  if (!rawJson) return null;
  try {
    const data = JSON.parse(rawJson) as Record<string, unknown>;
    return {
      name: String(data.name ?? "Unknown Creature"),
      size: formatSize(data.size),
      type: formatType(data.type),
      cr: typeof data.cr === "string" || typeof data.cr === "number" ? String(data.cr) : "—",
      ac: formatAc(data.ac),
      hp: formatHp(data.hp),
      source: typeof data.source === "string" ? data.source : "—"
    };
  } catch {
    return null;
  }
}

export function renderEntries(entries: unknown) {
  if (!entries) return "";
  if (typeof entries === "string") return stripTags(entries);
  if (Array.isArray(entries)) {
    return entries.map((entry) => renderEntries(entry)).filter(Boolean).join("\n\n");
  }
  if (typeof entries === "object") {
    const record = entries as Record<string, unknown>;
    if (record.entries) {
      const heading = typeof record.name === "string" ? `**${record.name}.** ` : "";
      return `${heading}${renderEntries(record.entries)}`.trim();
    }
  }
  return stripTags(JSON.stringify(entries, null, 2));
}

function normalizeEntries(value: unknown): MonsterEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") {
      return { name: "", entries: entry };
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      return {
        name: typeof record.name === "string" ? record.name : "",
        entries: record.entries ?? ""
      };
    }
    return { name: "", entries: "" };
  });
}

function stripTags(value: string) {
  return value.replace(/\{@[^}]+\s([^}]+)\}/g, "$1");
}

function formatSize(value: unknown) {
  if (Array.isArray(value) && value.length > 0) {
    const key = String(value[0]);
    return sizeMap[key] ?? key;
  }
  if (typeof value === "string") {
    return sizeMap[value] ?? value;
  }
  return "—";
}

function formatType(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const base = typeof record.type === "string" ? record.type : "—";
    if (Array.isArray(record.tags) && record.tags.length > 0) {
      return `${base} (${record.tags.join(", ")})`;
    }
    return base;
  }
  return "—";
}

function formatAlignment(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return alignmentMap[entry] ?? entry;
        if (entry && typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          if (typeof record.alignment === "string") {
            return alignmentMap[record.alignment] ?? record.alignment;
          }
          if (Array.isArray(record.alignment)) {
            return record.alignment
              .map((code) => (alignmentMap[String(code)] ?? String(code)))
              .join(" ");
          }
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "—";
}

function formatAc(value: unknown) {
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as unknown;
    if (typeof first === "number") return String(first);
    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      if (typeof record.ac === "number") return String(record.ac);
    }
  }
  return "—";
}

function formatHp(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const record = value as Record<string, unknown>;
  const average = record.average ?? record.avg;
  const formula = record.formula;
  if (average && formula) return `${average} (${formula})`;
  if (average) return String(average);
  if (formula) return String(formula);
  return "—";
}

function formatSpeed(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${value} ft.`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record)
      .map(([key, speed]) => {
        if (typeof speed === "number") return `${key} ${speed} ft.`;
        if (typeof speed === "string") return `${key} ${speed}`;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "—";
}

function formatSkill(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const record = value as Record<string, unknown>;
  return Object.entries(record)
    .map(([key, bonus]) => `${key} ${bonus}`)
    .filter(Boolean)
    .join(", ");
}

function formatSenses(data: Record<string, unknown>) {
  const senses = data.senses;
  const passive = data.passive;
  const senseText = Array.isArray(senses)
    ? senses.join(", ")
    : typeof senses === "string"
      ? senses
      : "";
  const passiveText =
    typeof passive === "number" || typeof passive === "string"
      ? `passive Perception ${passive}`
      : "";
  return [senseText, passiveText].filter(Boolean).join(", ") || "—";
}
