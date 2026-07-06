import { useEffect } from "react";

export function buildDocumentTitle(pageTitle?: string | null, campaignName?: string | null) {
  const parts = [pageTitle?.trim(), campaignName?.trim(), "Worldbuilder"].filter(Boolean);
  return parts.join(" / ");
}

export function buildMetaDescription(body?: string | null) {
  return (body ?? "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/[#>*_`~[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155);
}

export function useDocumentMeta({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousTitle = document.title;
    const meta =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.head.appendChild(document.createElement("meta"));
    const previousDescription = meta.getAttribute("content");
    meta.setAttribute("name", "description");
    document.title = title;
    if (description) meta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription === null) {
        meta.removeAttribute("content");
      } else {
        meta.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
