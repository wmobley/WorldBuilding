import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractText, stripIndexMarkers, transformWikilinks } from "../pages/vault/utils";

export default function MarkdownPreview({
  content,
  onOpenLink
}: {
  content: string;
  onOpenLink: (title: string) => void;
}) {
  const processed = transformWikilinks(stripIndexMarkers(content));
  return (
    <article className="markdown space-y-4 font-body text-ink text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
        {processed}
      </ReactMarkdown>
    </article>
  );
}
