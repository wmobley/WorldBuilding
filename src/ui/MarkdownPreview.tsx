import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { INDEX_END, INDEX_START } from "../vault/indexing";

const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function transformWikilinks(markdown: string) {
  return markdown.replace(wikilinkRegex, (_, target: string, alias?: string) => {
    const label = (alias || target).trim();
    const trimmed = target.trim();
    if (trimmed.toLowerCase().startsWith("folder:")) {
      const folderName = trimmed.slice("folder:".length).trim();
      const display = alias ? alias.trim() : folderName;
      return `[${display}](/folder/${encodeURIComponent(folderName)})`;
    }
    if (trimmed.startsWith("doc:")) {
      const docId = trimmed.slice(4);
      return `[${label}](doc:${docId}|${label})`;
    }
    if (trimmed.startsWith("ref:")) {
      const payload = trimmed.slice(4);
      const [slug, entryId] = payload.split(":");
      return `[${label}](ref:${slug}:${entryId}|${label})`;
    }
    const href = `wiki:${encodeURIComponent(trimmed)}`;
    return `[${label}](${href})`;
  });
}

function stripIndexMarkers(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== INDEX_START && trimmed !== INDEX_END;
    })
    .join("\n");
}

export default function MarkdownPreview({
  content,
  onOpenLink
}: {
  content: string;
  onOpenLink: (title: string) => void;
}) {
  const processed = transformWikilinks(stripIndexMarkers(content));
  const extractText = (nodes: React.ReactNode): string => {
    if (typeof nodes === "string") return nodes;
    if (Array.isArray(nodes)) return nodes.map(extractText).join("");
    if (nodes && typeof nodes === "object" && "props" in nodes) {
      return extractText((nodes as { props?: { children?: React.ReactNode } }).props?.children);
    }
    return "";
  };

  return (
    <article className="markdown space-y-4 font-body text-ink text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith("wiki:")) {
              let title = decodeURIComponent(href.replace("wiki:", ""));
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
            if (href && href.startsWith("doc:")) {
              return (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenLink(href);
                  }}
                  className="text-accent-map underline"
                >
                  {children}
                </a>
              );
            }
            if (href && href.startsWith("ref:")) {
              return (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenLink(href);
                  }}
                  className="text-accent-map underline"
                >
                  {children}
                </a>
              );
            }
            if (href && href.startsWith("/doc/")) {
              const id = href.replace("/doc/", "");
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
            if (href && href.startsWith("/folder/")) {
              const name = decodeURIComponent(href.replace("/folder/", ""));
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
            return (
              <a href={href} className="text-accent-map underline" rel="noreferrer">
                {children}
              </a>
            );
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </article>
  );
}
