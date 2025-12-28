import type { Doc } from "../vault/types";

export type ImportSource = "auto" | "foundry" | "5etools";

export type ImportedEntry = {
  title: string;
  body: string;
};

export type ImportedReferenceEntry = {
  name: string;
  content: string;
  source: string;
  slug: string;
  rawJson?: string;
};

export type ImportedBestiaryEntry = {
  name: string;
  source: string;
  rawJson: string;
  content: string;
};

type FoundryEntry = {
  name?: string;
  content?: string;
  pages?: Array<{
    name?: string;
    type?: string;
    text?: { content?: string; markdown?: string };
    content?: string;
  }>;
};

type FoundryItem = {
  name?: string;
  type?: string;
  system?: {
    description?: { value?: string } | string;
    details?: { biography?: { value?: string } };
  };
  description?: string;
  content?: string;
};

const headingPattern = /^(#{1,6})\s+/;

export function detectImportSource(data: unknown): "foundry" | "5etools" | null {
  if (Array.isArray(data)) {
    if (data.some((item) => is5eToolsItem(item))) return "5etools";
    if (data.some((item) => isFoundryEntry(item))) return "foundry";
    if (data.some((item) => isFoundryItem(item))) return "foundry";
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (is5eToolsContainer(record)) {
    return "5etools";
  }
  const foundryCandidates = [
    record.entries,
    record.journal,
    record.journals,
    record.data,
    record.content
  ];
  if (foundryCandidates.some((value) => Array.isArray(value) && value.some(isFoundryEntry))) {
    return "foundry";
  }
  if (
    Object.values(record).some(
      (value) => Array.isArray(value) && value.some(isFoundryItem)
    )
  ) {
    return "foundry";
  }
  if (Object.values(record).some((value) => Array.isArray(value) && value.some(is5eToolsItem))) {
    return "5etools";
  }
  return null;
}

export function extractFoundryEntries(data: unknown): ImportedEntry[] {
  const entries = resolveFoundryEntries(data);
  return entries.map((entry) => {
    const title = entry.name?.trim() || "Untitled Journal";
    const content = resolveFoundryContent(entry);
    const body = content ? htmlToMarkdown(content) : "";
    return { title, body };
  });
}

export function extractFoundryReferenceEntries(data: unknown): ImportedReferenceEntry[] {
  const entries = resolveFoundryReferenceEntries(data);
  return entries.map((entry) => {
    const name = entry.name?.trim() || "Untitled Reference";
    const content = resolveFoundryItemContent(entry);
    return {
      name,
      content: content ? htmlToMarkdown(content) : "",
      source: "Foundry",
      slug: "imports-foundry"
    };
  });
}

export function extract5eToolsEntries(data: unknown): ImportedEntry[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const entries: ImportedEntry[] = [];

  Object.values(record).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      if (!is5eToolsItem(item)) return;
      const payload = item as Record<string, unknown>;
      const title = String(payload.name ?? "Untitled Entry");
      const body = render5eToolsMarkdown(payload);
      entries.push({ title, body });
    });
  });

  return entries;
}

export function extract5eToolsReferenceEntries(data: unknown): ImportedReferenceEntry[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const entries: ImportedReferenceEntry[] = [];

  Object.entries(record).forEach(([category, value]) => {
    if (!Array.isArray(value)) return;
    if (category === "monster") return;
    value.forEach((item) => {
      if (!is5eToolsItem(item)) return;
      const payload = item as Record<string, unknown>;
      const name = String(payload.name ?? "Untitled Entry");
      const enriched = { ...payload, __category: category, __slug: "imports-5etools" };
      const content = render5eToolsMarkdown(enriched);
      const source = typeof payload.source === "string" ? payload.source : "5e.tools";
      entries.push({
        name,
        content,
        source: category ? `${source} • ${category}` : source,
        slug: "imports-5etools",
        rawJson: JSON.stringify(enriched)
      });
    });
  });

  return entries;
}

export function extract5eToolsBestiaryEntries(data: unknown): ImportedBestiaryEntry[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const monsters = record.monster;
  if (!Array.isArray(monsters)) return [];
  return monsters
    .filter(is5eToolsItem)
    .map((item) => {
      const payload = item as Record<string, unknown>;
      return {
        name: String(payload.name ?? "Untitled Creature"),
        source: typeof payload.source === "string" ? payload.source : "5e.tools",
        rawJson: JSON.stringify(payload),
        content: render5eToolsMarkdown(payload)
      };
    });
}

export function buildFoundryExport(docs: Doc[]) {
  return {
    type: "JournalEntry",
    entries: docs.map((doc) => ({
      name: doc.title,
      content: markdownToHtmlSimple(doc.body)
    }))
  };
}

export function buildRoll20Export(docs: Doc[]) {
  return {
    type: "handouts",
    handouts: docs.map((doc) => ({
      name: doc.title,
      notes: markdownToHtmlSimple(doc.body),
      gmnotes: ""
    }))
  };
}

function resolveFoundryEntries(data: unknown): FoundryEntry[] {
  if (Array.isArray(data)) {
    return data.filter(isFoundryEntry) as FoundryEntry[];
  }
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = [record.entries, record.journal, record.journals, record.data, record.content];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.some(isFoundryEntry)) {
      return candidate.filter(isFoundryEntry) as FoundryEntry[];
    }
  }
  return [];
}

function resolveFoundryContent(entry: FoundryEntry): string {
  if (typeof entry.content === "string") return entry.content;
  if (Array.isArray(entry.pages)) {
    return entry.pages
      .map((page) => page.text?.content ?? page.text?.markdown ?? page.content ?? "")
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

function isFoundryEntry(value: unknown): value is FoundryEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    (typeof record.content === "string" || Array.isArray(record.pages))
  );
}

function resolveFoundryReferenceEntries(data: unknown): FoundryItem[] {
  if (Array.isArray(data)) {
    return data.filter(isFoundryItem) as FoundryItem[];
  }
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = Object.values(record).filter((value) => Array.isArray(value));
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.some(isFoundryItem)) {
      return candidate.filter(isFoundryItem) as FoundryItem[];
    }
  }
  return [];
}

function resolveFoundryItemContent(entry: FoundryItem): string {
  if (typeof entry.content === "string") return entry.content;
  const description = entry.system?.description;
  if (typeof description === "string") return description;
  if (description && typeof description === "object" && typeof description.value === "string") {
    return description.value;
  }
  const biography = entry.system?.details?.biography?.value;
  if (typeof biography === "string") return biography;
  if (typeof entry.description === "string") return entry.description;
  return "";
}

function isFoundryItem(value: unknown): value is FoundryItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && ("system" in record || "type" in record);
}

function is5eToolsItem(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") return false;
  return (
    "entries" in record ||
    "entry" in record ||
    "fluff" in record ||
    "entriesHigherLevel" in record
  );
}

function is5eToolsContainer(record: Record<string, unknown>) {
  const keys = new Set([
    "action",
    "adventure",
    "background",
    "bastion",
    "bestiary",
    "boon",
    "book",
    "condition",
    "cult",
    "deck",
    "deity",
    "disease",
    "feat",
    "item",
    "items",
    "language",
    "monster",
    "object",
    "optionalfeature",
    "psionic",
    "race",
    "recipe",
    "reward",
    "spell",
    "table",
    "trap",
    "hazard",
    "vehicle"
  ]);
  return Object.entries(record).some(([key, value]) => {
    if (!keys.has(key)) return false;
    if (!Array.isArray(value)) return false;
    return value.some(is5eToolsItem);
  });
}

export function render5eToolsMarkdown(payload: Record<string, unknown>) {
  const sections: string[] = [];
  const mainEntries = extractEntries(payload);
  if (mainEntries) {
    sections.push(mainEntries);
  }
  const higher = renderEntries(payload.entriesHigherLevel);
  if (higher) {
    sections.push("## At Higher Levels\n" + higher);
  }
  const fluff = renderEntries((payload.fluff as { entries?: unknown })?.entries);
  if (fluff) {
    sections.push("## Lore\n" + fluff);
  }
  const source = typeof payload.source === "string" ? payload.source : null;
  if (source) {
    sections.push(`_Source: ${source}_`);
  }
  const body = sections.filter(Boolean).join("\n\n").trim();
  return body;
}

function extractEntries(payload: Record<string, unknown>) {
  if (payload.entries) {
    return renderEntries(payload.entries);
  }
  if (payload.entry) {
    return renderEntries(payload.entry);
  }
  return "";
}

function renderEntries(entries: unknown): string {
  if (!entries) return "";
  if (typeof entries === "string") return stripTags(entries);
  if (Array.isArray(entries)) {
    return entries.map((entry) => renderEntries(entry)).filter(Boolean).join("\n\n");
  }
  if (typeof entries === "object") {
    const record = entries as Record<string, unknown>;
    if (record.type === "entries" && record.entries) {
      const name = typeof record.name === "string" ? record.name : null;
      const heading = name ? `## ${name}\n\n` : "";
      return heading + renderEntries(record.entries);
    }
    if (record.type === "list" && Array.isArray(record.items)) {
      return record.items
        .map((item) => `- ${renderEntries(item)}`.trim())
        .filter(Boolean)
        .join("\n");
    }
    if (record.type === "table" && Array.isArray(record.rows)) {
      return renderTable(record);
    }
    if (record.entries) {
      return renderEntries(record.entries);
    }
    if (record.entry) {
      return renderEntries(record.entry);
    }
  }
  return stripTags(JSON.stringify(entries, null, 2));
}

function renderTable(record: Record<string, unknown>) {
  const labels = Array.isArray(record.colLabels)
    ? record.colLabels.map((label) => String(label))
    : [];
  const header = labels.length > 0 ? `| ${labels.join(" | ")} |` : "";
  const divider = labels.length > 0 ? `| ${labels.map(() => "---").join(" | ")} |` : "";
  const rows = (record.rows as unknown[])
    .map((row) => {
      if (!Array.isArray(row)) return "";
      return `| ${row.map((cell) => renderEntries(cell)).join(" | ")} |`;
    })
    .filter(Boolean);
  return [header, divider, ...rows].filter(Boolean).join("\n");
}

function stripTags(value: string) {
  return value.replace(/\{@[^}]+\s([^}]+)\}/g, "$1");
}

function htmlToMarkdown(html: string) {
  type Replacement = [RegExp, string | ((match: string, ...args: string[]) => string)];
  const replacements: Replacement[] = [
    [/<\s*br\s*\/?>/gi, "\n"],
    [/<\s*\/p\s*>/gi, "\n\n"],
    [
      /<\s*h([1-6])[^>]*>/gi,
      (_match: string, level: string) => `${"#".repeat(Number(level))} `
    ],
    [/<\s*\/h[1-6]\s*>/gi, "\n\n"],
    [/<\s*li[^>]*>/gi, "- "],
    [/<\s*\/li\s*>/gi, "\n"],
    [/<\s*\/ul\s*>/gi, "\n"],
    [/<\s*\/ol\s*>/gi, "\n"],
    [/<\s*blockquote[^>]*>/gi, "> "],
    [/<\s*\/blockquote\s*>/gi, "\n\n"]
  ];

  let text = html;
  replacements.forEach(([regex, value]) => {
    if (typeof value === "string") {
      text = text.replace(regex, value);
      return;
    }
    text = text.replace(regex, (...args) => value(args[0], ...args.slice(1)));
  });

  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\r/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function markdownToHtmlSimple(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const text = currentParagraph.join(" ").trim();
    if (text) {
      blocks.push(`<p>${escapeHtml(text)}</p>`);
    }
    currentParagraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    const headingMatch = trimmed.match(headingPattern);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${escapeHtml(trimmed.replace(headingPattern, ""))}</h${level}>`);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      const listItems: string[] = [];
      let cursor = index;
      while (cursor < lines.length && lines[cursor].trim().startsWith("- ")) {
        listItems.push(lines[cursor].trim().replace(/^- /, ""));
        cursor += 1;
      }
      blocks.push(
        `<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      );
      index = cursor - 1;
      continue;
    }
    currentParagraph.push(trimmed);
  }
  flushParagraph();
  return blocks.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
