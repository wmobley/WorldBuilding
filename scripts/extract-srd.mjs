import fs from "fs";
import path from "path";

const root = path.resolve("5esourcecode/data");
const outDir = path.resolve("src/data/srd");
const outFile = path.join(outDir, "reference-data.json");

const config = [
  { slug: "actions", label: "Actions", sources: [{ file: "actions.json", key: "action" }] },
  { slug: "bastions", label: "Bastions", sources: [{ file: "bastions.json", key: "facility" }] },
  {
    slug: "bestiary",
    label: "Bestiary",
    sources: [{ dir: "bestiary", pattern: /^bestiary-.*\.json$/, key: "monster" }]
  },
  {
    slug: "conditions-diseases",
    label: "Conditions & Diseases",
    sources: [{ file: "conditionsdiseases.json", key: "condition" }, { file: "conditionsdiseases.json", key: "disease" }]
  },
  { slug: "decks", label: "Decks", sources: [{ file: "decks.json", key: "deck" }] },
  { slug: "deities", label: "Deities", sources: [{ file: "deities.json", key: "deity" }] },
  { slug: "items", label: "Items", sources: [{ file: "items.json", key: "item" }] },
  { slug: "languages", label: "Languages", sources: [{ file: "languages.json", key: "language" }] },
  { slug: "rewards", label: "Supernatural Gifts & Rewards", sources: [{ file: "rewards.json", key: "reward" }] },
  { slug: "psionics", label: "Psionics", sources: [{ file: "psionics.json", key: "psionic" }] },
  {
    slug: "spells",
    label: "Spells",
    sources: [{ dir: "spells", pattern: /^spells-.*\.json$/, key: "spell" }]
  },
  {
    slug: "vehicles",
    label: "Vehicles",
    sources: [{ file: "vehicles.json", key: "vehicle" }, { file: "vehicles.json", key: "vehicleUpgrade" }]
  },
  { slug: "recipes", label: "Recipes", sources: [{ file: "recipes.json", key: "recipe" }] },
  { slug: "adventures", label: "Adventures", sources: [{ file: "adventures.json", key: "adventure" }] },
  { slug: "cults-boons", label: "Cults & Supernatural Boons", sources: [{ file: "cultsboons.json", key: "cult" }, { file: "cultsboons.json", key: "boon" }] },
  { slug: "objects", label: "Objects", sources: [{ file: "objects.json", key: "object" }] },
  { slug: "traps-hazards", label: "Traps & Hazards", sources: [{ file: "trapshazards.json", key: "trap" }, { file: "trapshazards.json", key: "hazard" }] }
];

const cleanInline = (value) =>
  value.replace(/\{@[^}]+\}/g, (match) => {
    const inner = match.slice(2, -1).trim();
    const parts = inner.split(/\s+/);
    parts.shift();
    const rest = parts.join(" ");
    return rest.split("|")[0] || "";
  });

const renderEntries = (entry, depth = 0) => {
  if (entry == null) return "";
  if (typeof entry === "string") {
    return cleanInline(entry);
  }
  if (Array.isArray(entry)) {
    return entry.map((item) => renderEntries(item, depth)).filter(Boolean).join("\n\n");
  }
  if (typeof entry === "object") {
    if (entry.type === "list" && Array.isArray(entry.items)) {
      return entry.items
        .map((item) => `- ${renderEntries(item, depth + 1).replace(/\n+/g, " ")}`)
        .join("\n");
    }
    if (entry.type === "table" && Array.isArray(entry.rows)) {
      const headers = (entry.colLabels || []).map((label) => cleanInline(String(label)));
      const headerRow = headers.length ? `| ${headers.join(" | ")} |` : "";
      const separator = headers.length ? `| ${headers.map(() => "---").join(" | ")} |` : "";
      const rows = entry.rows
        .map((row) =>
          `| ${row.map((cell) => cleanInline(renderEntries(cell, depth + 1))).join(" | ")} |`
        )
        .join("\n");
      return [entry.caption ? `**${cleanInline(entry.caption)}**` : "", headerRow, separator, rows]
        .filter(Boolean)
        .join("\n");
    }
    if (entry.type === "entries" || entry.type === "section") {
      const title = entry.name ? `### ${cleanInline(entry.name)}` : "";
      const body = renderEntries(entry.entries || entry.entry, depth + 1);
      return [title, body].filter(Boolean).join("\n\n");
    }
    if (entry.type === "item") {
      const title = entry.name ? `- **${cleanInline(entry.name)}.**` : "-";
      const body = renderEntries(entry.entries || entry.entry, depth + 1).replace(/\n+/g, " ");
      return `${title} ${body}`.trim();
    }
    if (entry.type === "inset" || entry.type === "quote") {
      const body = renderEntries(entry.entries || entry.entry, depth + 1)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      const title = entry.name ? `> **${cleanInline(entry.name)}**` : "";
      return [title, body].filter(Boolean).join("\n");
    }
    if (entry.entries || entry.entry) {
      return renderEntries(entry.entries || entry.entry, depth + 1);
    }
  }
  return "";
};

const buildContent = (item) => {
  const sections = [];
  if (item.entries) {
    sections.push(renderEntries(item.entries));
  }
  if (item.entriesHigherLevel) {
    sections.push(`## At Higher Levels\n\n${renderEntries(item.entriesHigherLevel)}`);
  }
  const blocks = [
    { key: "trait", title: "Traits" },
    { key: "action", title: "Actions" },
    { key: "bonus", title: "Bonus Actions" },
    { key: "reaction", title: "Reactions" },
    { key: "legendary", title: "Legendary Actions" },
    { key: "mythic", title: "Mythic Actions" },
    { key: "lairActions", title: "Lair Actions" },
    { key: "regionalEffects", title: "Regional Effects" },
    { key: "spellcasting", title: "Spellcasting" }
  ];
  blocks.forEach(({ key, title }) => {
    const value = item[key];
    if (!value) return;
    const content = renderEntries(value);
    if (content) {
      sections.push(`## ${title}\n\n${content}`);
    }
  });
  return sections.filter(Boolean).join("\n\n").trim();
};

const loadFile = (filePath, key) => {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const items = data[key] || [];
  return items.filter((item) => item.srd);
};

const loadFromSource = (source) => {
  if (source.file) {
    return loadFile(path.join(root, source.file), source.key);
  }
  if (source.dir) {
    const dirPath = path.join(root, source.dir);
    const files = fs.readdirSync(dirPath).filter((file) => source.pattern.test(file));
    return files.flatMap((file) => loadFile(path.join(dirPath, file), source.key));
  }
  return [];
};

const output = {
  generatedAt: new Date().toISOString(),
  references: {}
};

config.forEach((entry) => {
  const items = entry.sources.flatMap(loadFromSource);
  output.references[entry.slug] = items.map((item) => ({
    name: item.name || item.shortName || "Untitled",
    source: item.source || "SRD",
    content: buildContent(item)
  }));
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`Wrote ${outFile}`);
