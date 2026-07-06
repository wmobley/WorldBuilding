export type FrontmatterValue = string | number | boolean | string[];

export type ParsedFrontmatter = {
  fields: Record<string, FrontmatterValue>;
  raw: string;
  error?: string;
};

export type ParsedMarkdownPage = {
  body: string;
  frontmatter: ParsedFrontmatter | null;
};

export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
  line: number;
};

export type PageInsert = {
  target: string;
};

export type WikiEmbed = {
  target: string;
  alt?: string;
};

export type WikiGallery = {
  targets: string[];
};

function parseScalar(value: string): FrontmatterValue {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => String(parseScalar(item)))
      .filter(Boolean);
  }
  return trimmed;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const fields: Record<string, FrontmatterValue> = {};
  const lines = raw.split(/\r?\n/);
  let activeListKey: string | null = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem) {
      if (!activeListKey) {
        return { fields, raw, error: `List item without a key: ${line.trim()}` };
      }
      const current = fields[activeListKey];
      const next = Array.isArray(current) ? current : [];
      next.push(String(parseScalar(listItem[1])));
      fields[activeListKey] = next;
      continue;
    }

    const keyValue = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!keyValue) {
      return { fields, raw, error: `Malformed frontmatter line: ${line.trim()}` };
    }

    const key = keyValue[1].trim();
    const value = keyValue[2].trim();
    if (!value) {
      fields[key] = [];
      activeListKey = key;
      continue;
    }

    fields[key] = parseScalar(value);
    activeListKey = null;
  }

  return { fields, raw };
}

export function parseMarkdownPage(markdown: string): ParsedMarkdownPage {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { body: markdown, frontmatter: null };
  }

  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      body: markdown,
      frontmatter: {
        fields: {},
        raw: markdown,
        error: "Frontmatter starts with --- but has no closing --- marker."
      }
    };
  }

  const raw = match[1];
  return {
    body: markdown.slice(match[0].length),
    frontmatter: parseFrontmatter(raw)
  };
}

export function slugifyHeading(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createHeadingIdGenerator() {
  const counts = new Map<string, number>();

  return (text: string, fallback = "section") => {
    const base = slugifyHeading(text) || fallback;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

function stripInlineMarkdown(input: string) {
  return input
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#>]/g, "")
    .trim();
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const { body } = parseMarkdownPage(markdown);
  const lines = body.split(/\r?\n/);
  const nextHeadingId = createHeadingIdGenerator();
  const headings: MarkdownHeading[] = [];
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const text = stripInlineMarkdown(match[2]);
    if (!text) return;
    headings.push({
      id: nextHeadingId(text, `section-${index + 1}`),
      level: match[1].length,
      text,
      line: index + 1
    });
  });

  return headings;
}

export function extractPageInserts(markdown: string): PageInsert[] {
  return Array.from(markdown.matchAll(/{{\s*insert:\s*([^}]+?)\s*}}/g)).map((match) => ({
    target: match[1].trim()
  }));
}

export function extractEmbeds(markdown: string): WikiEmbed[] {
  return Array.from(markdown.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)).map((match) => ({
    target: match[1].trim(),
    alt: match[2]?.trim()
  }));
}

export function extractGalleries(markdown: string): WikiGallery[] {
  return Array.from(markdown.matchAll(/{{\s*gallery:\s*([^}]+?)\s*}}/g)).map((match) => ({
    targets: match[1]
      .split(",")
      .map((target) => target.trim())
      .filter(Boolean)
  }));
}

export function splitLinkSectionTarget(target: string) {
  const [base, ...sectionParts] = target.trim().split("#");
  return {
    base: base.trim(),
    section: sectionParts.join("#").trim() || null
  };
}

export function normalizeSectionId(section: string) {
  const trimmed = section.trim().replace(/^#/, "");
  return slugifyHeading(trimmed) || trimmed;
}

export function countWikiLinkTargetReplacements(markdown: string, oldTitle: string) {
  const oldTrimmed = oldTitle.trim();
  if (!oldTrimmed) return 0;
  return Array.from(markdown.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)).filter(
    (match) => {
      const target = String(match[1] ?? "").trim();
      if (target.startsWith("asset:")) return false;
      return splitLinkSectionTarget(target).base === oldTrimmed;
    }
  ).length;
}

export function replaceWikiLinkTarget(markdown: string, oldTitle: string, newTitle: string) {
  const oldTrimmed = oldTitle.trim();
  const newTrimmed = newTitle.trim();
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return markdown;

  return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target: string, alias?: string) => {
    const { base, section } = splitLinkSectionTarget(target);
    if (base !== oldTrimmed) return match;
    const nextTarget = section ? `${newTrimmed}#${section}` : newTrimmed;
    return alias ? `[[${nextTarget}|${alias.trim()}]]` : `[[${nextTarget}]]`;
  });
}

export function isAssetLikeTarget(target: string) {
  return /\.(avif|gif|jpe?g|png|svg|webp|pdf|mp3|mp4|webm|wav)$/i.test(target.trim());
}
