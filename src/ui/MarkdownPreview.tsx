import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Asset, Doc } from "../vault/types";
import {
  createHeadingIdGenerator,
  parseMarkdownPage,
  type FrontmatterValue
} from "../domain/markdown/pageModel";
import { createSignedAssetUrl, isImageAsset } from "../vault/assets";
import { extractText, stripIndexMarkers, transformWikilinks } from "../pages/vault/utils";

export default function MarkdownPreview({
  content,
  onOpenLink = () => undefined,
  docs = [],
  assets = [],
  audience = "dm"
}: {
  content: string;
  onOpenLink?: (title: string) => void;
  docs?: Doc[];
  assets?: Asset[];
  audience?: "dm" | "player";
}) {
  const page = parseMarkdownPage(stripIndexMarkers(content));
  const processed = transformWikilinks(page.body);
  const docsByTitle = new Map(docs.map((doc) => [doc.title.toLowerCase(), doc]));
  const nextHeadingId = createHeadingIdGenerator();
  const assetsByTarget = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach((asset) => {
      map.set(`asset:${asset.id}`, asset);
      map.set(asset.id, asset);
      map.set(asset.storagePath, asset);
      map.set(asset.filename, asset);
    });
    return map;
  }, [assets]);

  const renderMarkdown = (markdown: string, key: string) => (
    <ReactMarkdown
      key={key}
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <Heading level={1} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        h2: ({ children }) => (
          <Heading level={2} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        h3: ({ children }) => (
          <Heading level={3} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        h4: ({ children }) => (
          <Heading level={4} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        h5: ({ children }) => (
          <Heading level={5} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        h6: ({ children }) => (
          <Heading level={6} id={nextHeadingId(extractText(children).trim())}>
            {children}
          </Heading>
        ),
        a: ({ href, children }) => {
          const resolveLocalHref = (value: string) => {
            if (value.startsWith("http://") || value.startsWith("https://")) {
              try {
                const url = new URL(value);
                if (typeof window !== "undefined" && url.origin === window.location.origin) {
                  return url.pathname + url.search + url.hash;
                }
              } catch {
                return value;
              }
            }
            return value;
          };
          const resolvedHref = href ? resolveLocalHref(href) : href;
          if (resolvedHref && resolvedHref.startsWith("wiki:")) {
            let title = decodeURIComponent(resolvedHref.replace("wiki:", ""));
            if (title.startsWith("doc:")) {
              const [docIdPart] = title.split("|");
              title = docIdPart;
            }
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(title);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          if (resolvedHref && resolvedHref.startsWith("doc:")) {
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(resolvedHref);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          if (resolvedHref && resolvedHref.startsWith("ref:")) {
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(resolvedHref);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          if (resolvedHref && resolvedHref.startsWith("/doc/")) {
            const id = resolvedHref.replace("/doc/", "");
            const label = extractText(children).trim();
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(label ? `doc:${id}|${label}` : `doc:${id}`);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          if (resolvedHref && resolvedHref.startsWith("/folder/")) {
            const name = decodeURIComponent(resolvedHref.replace("/folder/", ""));
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(`folder:${name}`);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          if (resolvedHref && resolvedHref.startsWith("/reference/")) {
            const [pathPart, queryPart] = resolvedHref.split("?");
            const slug = pathPart.replace("/reference/", "");
            const params = new URLSearchParams(queryPart ?? "");
            const entryId = params.get("entry");
            if (slug && entryId) {
              return (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenLink(`ref:${slug}:${entryId}`);
                  }}
                  className="text-accent-map underline"
                >
                  {children}
                </a>
              );
            }
          }
          if (
            resolvedHref &&
            !resolvedHref.startsWith("/") &&
            !resolvedHref.startsWith("#") &&
            !resolvedHref.startsWith("http://") &&
            !resolvedHref.startsWith("https://")
          ) {
            const label = decodeURIComponent(resolvedHref);
            return (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink(label);
                }}
                className="text-accent-map underline"
              >
                {children}
              </a>
            );
          }
          return (
            <a href={href} className="text-accent-map underline" rel="noreferrer">
              {children}
            </a>
          );
        }
      }}
    >
      {markdown}
    </ReactMarkdown>
  );

  const renderBlocks = (markdown: string, depth = 0, seenDocIds = new Set<string>()): ReactNode[] => {
    const blocks: ReactNode[] = [];
    const lines = markdown.split("\n");
    let buffer: string[] = [];
    let index = 0;

    const flush = () => {
      if (buffer.join("\n").trim()) {
        blocks.push(renderMarkdown(buffer.join("\n"), `md-${depth}-${blocks.length}`));
      }
      buffer = [];
    };

    while (index < lines.length) {
      const line = lines[index];
      const directive = line.match(/^:::(spoiler|dm-only|player-facing|player|rumor|quest-hook|npc-card|deity-card|faction-card|dungeon-floor|timeline|relationship-diagram|session-recap)(?:\s+title="([^"]+)")?\s*$/);
      if (directive) {
        flush();
        const kind = directive[1];
        const title =
          directive[2] ??
          directiveLabel(kind);
        const inner: string[] = [];
        index += 1;
        while (index < lines.length && lines[index].trim() !== ":::") {
          inner.push(lines[index]);
          index += 1;
        }
        if (!(audience === "player" && kind === "dm-only")) {
          const isCollapsible = kind === "spoiler" || kind === "dm-only";
          const isProfileBlock = [
            "npc-card",
            "deity-card",
            "faction-card",
            "dungeon-floor",
            "timeline",
            "relationship-diagram",
            "session-recap"
          ].includes(kind);
          blocks.push(
            isCollapsible ? (
              <details
              key={`directive-${depth}-${blocks.length}`}
              className="rounded-xl border border-page-edge bg-parchment/70 p-4"
              >
                <summary className="cursor-pointer font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  {title}
                </summary>
                <div className="mt-3">
                  {renderBlocks(transformWikilinks(inner.join("\n")), depth + 1, seenDocIds)}
                </div>
              </details>
            ) : (
              <section
                key={`directive-${depth}-${blocks.length}`}
                className={`rounded-xl border border-page-edge bg-parchment/70 p-4 ${
                  isProfileBlock ? "not-prose shadow-page" : ""
                }`}
              >
                <div className="font-ui text-xs uppercase tracking-[0.18em] text-ink-soft">
                  {title}
                </div>
                <div className="mt-3">
                  {renderBlocks(transformWikilinks(inner.join("\n")), depth + 1, seenDocIds)}
                </div>
              </section>
            )
          );
        }
        index += 1;
        continue;
      }

      const insert = line.match(/^{{\s*insert:\s*([^}]+?)\s*}}\s*$/);
      if (insert) {
        flush();
        const target = insert[1].trim();
        const insertedDoc = docsByTitle.get(target.toLowerCase());
        if (!insertedDoc) {
          blocks.push(
            <div key={`insert-missing-${depth}-${blocks.length}`} className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
              Missing inserted page: {target}
            </div>
          );
        } else if (seenDocIds.has(insertedDoc.id) || depth >= 3) {
          blocks.push(
            <div key={`insert-cycle-${depth}-${blocks.length}`} className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
              Insert skipped to avoid a circular page insert: {insertedDoc.title}
            </div>
          );
        } else if (audience === "player" && !insertedDoc.shared) {
          blocks.push(
            <div key={`insert-hidden-${depth}-${blocks.length}`} className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
              Insert hidden from player view.
            </div>
          );
        } else {
          const nextSeen = new Set(seenDocIds);
          nextSeen.add(insertedDoc.id);
          blocks.push(
            <section key={`insert-${insertedDoc.id}-${depth}`} className="rounded-xl border border-page-edge bg-parchment/60 p-4">
              <div className="mb-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                Inserted Page / {insertedDoc.title}
              </div>
              {renderBlocks(transformWikilinks(parseMarkdownPage(stripIndexMarkers(insertedDoc.body)).body), depth + 1, nextSeen)}
            </section>
          );
        }
        index += 1;
        continue;
      }

      const gallery = line.match(/^{{\s*gallery:\s*([^}]+?)\s*}}\s*$/);
      if (gallery) {
        flush();
        const galleryAssets = gallery[1]
          .split(",")
          .map((target) => assetsByTarget.get(target.trim()))
          .filter((asset): asset is Asset => Boolean(asset));
        if (galleryAssets.length > 0) {
          blocks.push(
            <AssetGallery
              key={`asset-gallery-${depth}-${blocks.length}`}
              assets={galleryAssets}
            />
          );
        } else {
          blocks.push(
            <div key={`gallery-missing-${depth}-${blocks.length}`} className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
              Gallery has no resolvable assets.
            </div>
          );
        }
        index += 1;
        continue;
      }

      const embed = line.match(/^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*$/);
      if (embed) {
        flush();
        const target = embed[1].trim();
        const alt = embed[2]?.trim() ?? target;
        const asset = assetsByTarget.get(target);
        if (asset) {
          blocks.push(
            <AssetEmbed
              key={`asset-embed-${asset.id}-${depth}-${blocks.length}`}
              asset={asset}
              alt={alt}
            />
          );
        } else if (/^(https?:|data:|\/)/.test(target)) {
          blocks.push(
            <figure key={`embed-${depth}-${blocks.length}`} className="space-y-2">
              <img src={target} alt={alt} className="max-h-[520px] w-full rounded-xl border border-page-edge object-contain" />
              {alt && <figcaption className="text-xs text-ink-soft">{alt}</figcaption>}
            </figure>
          );
        } else {
          blocks.push(
            <div key={`embed-placeholder-${depth}-${blocks.length}`} className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
              Media attachment: {target}
              {alt !== target ? ` / ${alt}` : ""}
            </div>
          );
        }
        index += 1;
        continue;
      }

      buffer.push(line);
      index += 1;
    }

    flush();
    return blocks;
  };

  return (
    <article className="markdown space-y-4 font-body text-ink text-base leading-relaxed">
      <FrontmatterInfobox fields={page.frontmatter?.fields ?? null} />
      {renderBlocks(processed)}
    </article>
  );
}

function AssetEmbed({ asset, alt }: { asset: Asset; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    createSignedAssetUrl(asset.storagePath)
      .then((signedUrl) => {
        if (active) setUrl(signedUrl);
      })
      .catch(() => {
        if (active) {
          setUrl(null);
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [asset.storagePath]);

  if (failed) {
    return (
      <div className="rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm text-ink-soft">
        Media unavailable: {asset.filename}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-page-edge bg-parchment/70" />
    );
  }

  if (!isImageAsset(asset)) {
    return (
      <a
        href={url}
        className="block rounded-xl border border-page-edge bg-parchment/70 p-4 text-accent-map underline"
        rel="noreferrer"
      >
        {alt || asset.filename}
      </a>
    );
  }

  return (
    <figure className="space-y-2">
      <img
        src={url}
        alt={alt || asset.altText || asset.filename}
        className="max-h-[520px] w-full rounded-xl border border-page-edge object-contain"
      />
      {(alt || asset.altText) && (
        <figcaption className="text-xs text-ink-soft">{alt || asset.altText}</figcaption>
      )}
    </figure>
  );
}

function AssetGallery({ assets }: { assets: Asset[] }) {
  return (
    <div className="not-prose grid gap-3 sm:grid-cols-2">
      {assets.map((asset) => (
        <AssetEmbed key={asset.id} asset={asset} alt={asset.altText || asset.filename} />
      ))}
    </div>
  );
}

function directiveLabel(kind: string) {
  if (kind === "dm-only") return "DM Only";
  if (kind === "rumor") return "Rumor";
  if (kind === "quest-hook") return "Quest Hook";
  if (kind === "player" || kind === "player-facing") return "Player Facing";
  if (kind === "npc-card") return "NPC Profile";
  if (kind === "deity-card") return "Deity Profile";
  if (kind === "faction-card") return "Faction Profile";
  if (kind === "dungeon-floor") return "Dungeon Floor";
  if (kind === "timeline") return "Timeline";
  if (kind === "relationship-diagram") return "Relationship Diagram";
  if (kind === "session-recap") return "Session Recap";
  return "Spoiler";
}

function Heading({
  level,
  id,
  children
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id: string;
  children: ReactNode;
}) {
  const text = extractText(children).trim();
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag id={id} className="group scroll-mt-24">
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 opacity-0 no-underline transition group-hover:opacity-70"
          aria-label={`Copy section link for ${text}`}
        >
          #
        </a>
      )}
    </Tag>
  );
}

function formatFieldValue(value: FrontmatterValue) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function formatFieldLabel(key: string) {
  return key.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FrontmatterInfobox({ fields }: { fields: Record<string, FrontmatterValue> | null }) {
  if (!fields) return null;
  const entries = Object.entries(fields).filter(([key, value]) => {
    if (key === "tags" || key === "title") return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  });
  if (entries.length === 0) return null;
  return (
    <aside className="not-prose float-right mb-4 ml-6 w-full max-w-xs rounded-xl border border-page-edge bg-parchment/80 p-4 shadow-page">
      <div className="mb-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
        Infobox
      </div>
      <dl className="space-y-2 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="font-ui text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              {formatFieldLabel(key)}
            </dt>
            <dd className="text-ink">{formatFieldValue(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
