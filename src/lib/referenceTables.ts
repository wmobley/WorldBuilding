type RowSummary = {
  name: string;
  columns: string[];
  source: string;
  detail: string;
  category?: string;
};

const schoolMap: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
  V: "Evocation"
};

const sizeMap: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan"
};

export function buildReferenceRow(rawJson?: string) {
  if (!rawJson) return null;
  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function summarizeReference(slug: string, rawJson?: string, detail = ""): RowSummary | null {
  const payload = buildReferenceRow(rawJson);
  if (!payload) return null;
  const name = String(payload.name ?? "Unknown");
  const source = String(payload.source ?? "—");
  const category = typeof payload.__category === "string" ? payload.__category : undefined;

  switch (slug) {
    case "spells":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          formatSpellLevel(payload.level),
          schoolMap[String(payload.school ?? "")] ?? String(payload.school ?? "—"),
          formatTime(payload.time),
          formatRange(payload.range),
          formatDuration(payload.duration),
          source
        ]
      };
    case "items":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          String(payload.type ?? "—"),
          String(payload.rarity ?? "—"),
          formatAttunement(payload.reqAttune),
          formatValue(payload.value),
          source
        ]
      };
    case "traps-hazards":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          category ?? (payload.trapHazType ? "trap" : "hazard"),
          formatThreat(payload.rating),
          formatTier(payload.rating),
          source
        ]
      };
    case "objects":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          formatSize(payload.size),
          String(payload.objectType ?? "—"),
          formatAc(payload.ac),
          formatHp(payload.hp),
          source
        ]
      };
    case "rewards":
      return {
        name,
        source,
        category,
        detail,
        columns: [String(payload.type ?? "—"), source]
      };
    case "vehicles":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          String(payload.vehicleType ?? category ?? "—"),
          formatSize(payload.size),
          formatSpeed(payload.speed),
          source
        ]
      };
    case "deities":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          String(payload.pantheon ?? "—"),
          String(payload.category ?? "—"),
          formatAlignment(payload.alignment),
          source
        ]
      };
    case "languages":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          formatSpeakers(payload.typicalSpeakers),
          String(payload.script ?? payload.scriptSource ?? "—"),
          source
        ]
      };
    case "conditions-diseases":
      return {
        name,
        source,
        category,
        detail,
        columns: [
          category ?? "condition",
          payload.srd ? "SRD" : payload.basicRules ? "Basic" : "—",
          source
        ]
      };
    case "actions":
      return {
        name,
        source,
        category,
        detail,
        columns: [formatTime(payload.time), source]
      };
    default:
      return null;
  }
}

export function getTableColumns(slug: string) {
  switch (slug) {
    case "spells":
      return ["Level", "School", "Casting Time", "Range", "Duration", "Source"];
    case "items":
      return ["Type", "Rarity", "Attune", "Value", "Source"];
    case "traps-hazards":
      return ["Type", "Threat", "Tier", "Source"];
    case "objects":
      return ["Size", "Type", "AC", "HP", "Source"];
    case "rewards":
      return ["Type", "Source"];
    case "vehicles":
      return ["Type", "Size", "Speed", "Source"];
    case "deities":
      return ["Pantheon", "Category", "Alignment", "Source"];
    case "languages":
      return ["Speakers", "Script", "Source"];
    case "conditions-diseases":
      return ["Type", "Rules", "Source"];
    case "actions":
      return ["Time", "Source"];
    default:
      return [];
  }
}

function formatSpellLevel(value: unknown) {
  if (value === 0) return "Cantrip";
  if (typeof value === "number") return `Level ${value}`;
  return String(value ?? "—");
}

function formatTime(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const first = value[0] as Record<string, unknown>;
  if (!first) return "—";
  const number = first.number ?? "";
  const unit = first.unit ?? "";
  return `${number} ${unit}`.trim() || "—";
}

function formatRange(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const record = value as Record<string, unknown>;
  const distance = record.distance as Record<string, unknown> | undefined;
  if (!distance) return String(record.type ?? "—");
  if (distance.amount) return `${distance.amount} ${distance.type ?? ""}`.trim();
  return String(distance.type ?? "—");
}

function formatDuration(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const first = value[0] as Record<string, unknown>;
  if (!first) return "—";
  const type = String(first.type ?? "");
  const duration = first.duration as Record<string, unknown> | undefined;
  if (duration?.amount) {
    return `${duration.amount} ${duration.type ?? ""}`.trim();
  }
  if (type === "instant") return "Instant";
  if (type === "permanent") return "Permanent";
  return type || "—";
}

function formatAttunement(value: unknown) {
  if (!value) return "No";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "yes") return "Yes";
  return "Yes";
}

function formatValue(value: unknown) {
  if (!value) return "—";
  if (typeof value === "number") return `${value} gp`;
  if (typeof value === "string") return value;
  return "—";
}

function formatThreat(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const entry = value[0] as Record<string, unknown>;
  return String(entry.threat ?? "—");
}

function formatTier(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const entry = value[0] as Record<string, unknown>;
  return entry.tier ? `Tier ${entry.tier}` : "—";
}

function formatSize(value: unknown) {
  if (Array.isArray(value) && value.length > 0) {
    return sizeMap[String(value[0])] ?? String(value[0]);
  }
  if (typeof value === "string") return sizeMap[value] ?? value;
  return "—";
}

function formatAc(value: unknown) {
  if (typeof value === "number") return String(value);
  return "—";
}

function formatHp(value: unknown) {
  if (typeof value === "number") return String(value);
  return "—";
}

function formatSpeed(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${value} ft.`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const pieces = Object.entries(record)
      .filter(([key]) => key !== "note")
      .map(([key, val]) => {
        if (typeof val === "number") return `${key} ${val} ft.`;
        if (typeof val === "string") return `${key} ${val}`;
        return "";
      })
      .filter(Boolean);
    return pieces.join(", ") || "—";
  }
  return "—";
}

function formatAlignment(value: unknown) {
  if (!Array.isArray(value)) return "—";
  return value
    .map((entry) => String(entry))
    .filter(Boolean)
    .join(" ");
}

function formatSpeakers(value: unknown) {
  if (!Array.isArray(value)) return "—";
  return value.map((entry) => String(entry)).join(", ");
}
