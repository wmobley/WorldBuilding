import { useEffect, useState } from "react";
import { buildWorldContext, type WorldContext } from "../../prep/context";
import { createId } from "../../lib/id";
import { parseLinks, parseTags } from "../../vault/parser";
import {
  getDocById,
  getDocByTitle,
  getSetting,
  listDocsWithTag
} from "../../vault/queries";
import type { Campaign, Doc } from "../../vault/types";
import { sendPromptToProvider, type AiProvider } from "../../ai/client";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type UseVaultAiChatInput = {
  activeCampaignId: string | null;
  activeCampaign: Campaign | null;
  currentDoc: Doc | null;
  worldbuildContext: WorldContext | null;
};

const buildExcerpt = (body: string, limit = 360) => {
  const withoutLinks = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
  const withoutTags = withoutLinks.replace(/@[a-zA-Z]+:[\w-]+/g, "");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
};

const formatDate = (timestamp: number) => {
  if (!timestamp) return "unknown";
  return new Date(timestamp).toISOString().slice(0, 10);
};

const buildWorldContextSummary = (context: WorldContext) => {
  const tagLabels = context.currentDoc.tags.map((tag) => `@${tag.type}:${tag.value}`);
  const linkedTitles = context.linkedDocs.slice(0, 6).map((doc) => doc.title);
  const backlinkTitles = context.backlinks.slice(0, 6).map((doc) => doc.title);
  const relatedTags = context.relatedDocsByTag
    .filter((entry) => entry.docs.length > 0)
    .slice(0, 4)
    .map(
      (entry) =>
        `@${entry.type}:${entry.value} -> ${entry.docs
          .slice(0, 4)
          .map((doc) => doc.title)
          .join(", ")}`
    );
  const recentTitles = context.recentlyUpdatedDocs
    .slice(0, 6)
    .map((doc) => `${doc.title} (${formatDate(doc.updatedAt)})`);
  const folderName = context.folderContext.folder?.name ?? "None";
  const siblingTitles = context.folderContext.siblings
    .slice(0, 6)
    .map((doc) => doc.title);

  return [
    "World Context:",
    `Current Page: ${context.currentDoc.title}`,
    `Tags: ${tagLabels.length > 0 ? tagLabels.join(", ") : "None"}`,
    context.currentDoc.excerpt ? `Excerpt: ${context.currentDoc.excerpt}` : null,
    linkedTitles.length > 0 ? `Linked Pages: ${linkedTitles.join(", ")}` : null,
    backlinkTitles.length > 0 ? `Backlinks: ${backlinkTitles.join(", ")}` : null,
    relatedTags.length > 0 ? `Related Tags: ${relatedTags.join(" | ")}` : null,
    recentTitles.length > 0 ? `Recently Updated: ${recentTitles.join(", ")}` : null,
    `Folder: ${folderName}`,
    siblingTitles.length > 0 ? `Sibling Pages: ${siblingTitles.join(", ")}` : null
  ]
    .filter(Boolean)
    .join("\n");
};

export default function useVaultAiChat({
  activeCampaignId,
  activeCampaign,
  currentDoc,
  worldbuildContext
}: UseVaultAiChatInput) {
  const [aiProvider, setAiProvider] = useState("none");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const loadAiProvider = async () => {
      const stored = await getSetting("aiProvider");
      if (stored) setAiProvider(stored);
    };
    loadAiProvider().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeCampaignId) {
      setAiMessages([]);
      return;
    }
    const stored = window.localStorage.getItem(`wb:aiChat:${activeCampaignId}`);
    if (!stored) {
      setAiMessages([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setAiMessages(
          parsed.filter(
            (entry) =>
              entry &&
              (entry.role === "user" || entry.role === "assistant") &&
              typeof entry.content === "string"
          )
        );
      }
    } catch {
      setAiMessages([]);
    }
  }, [activeCampaignId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeCampaignId) return;
    window.localStorage.setItem(
      `wb:aiChat:${activeCampaignId}`,
      JSON.stringify(aiMessages)
    );
  }, [aiMessages, activeCampaignId]);

  const buildChatPrompt = async (nextMessage: string) => {
    const synopsis = activeCampaign?.synopsis?.trim() || "None provided.";
    const name = activeCampaign?.name?.trim() || "Untitled Campaign";
    const history = aiMessages.slice(-8).map((message) => {
      const roleLabel = message.role === "user" ? "User" : "Assistant";
      return `${roleLabel}: ${message.content}`;
    });
    const context =
      worldbuildContext ?? (currentDoc ? await buildWorldContext(currentDoc.id) : null);
    const worldContextSection = context ? buildWorldContextSummary(context) : null;
    const linkTargets = parseLinks(nextMessage);
    const tagTargets = parseTags(nextMessage);
    const linkDocs: Array<{ label: string; excerpt: string }> = [];
    const missingLinks: string[] = [];
    const seenDocIds = new Set<string>();

    for (const link of linkTargets) {
      let doc = null;
      if (link.docId) {
        doc = await getDocById(link.docId);
      } else if (activeCampaignId) {
        doc = await getDocByTitle(link.targetTitle, activeCampaignId);
      }
      if (doc && !doc.deletedAt && !seenDocIds.has(doc.id)) {
        seenDocIds.add(doc.id);
        linkDocs.push({ label: doc.title, excerpt: buildExcerpt(doc.body ?? "") });
      } else {
        missingLinks.push(link.targetTitle);
      }
    }

    const tagContexts: Array<{ tag: string; docs: string[] }> = [];
    if (activeCampaignId) {
      for (const tag of tagTargets) {
        const docsWithTag = await listDocsWithTag(tag.type, tag.value, activeCampaignId);
        const titles = docsWithTag
          .filter((doc) => !doc.deletedAt)
          .slice(0, 4)
          .map((doc) => doc.title);
        tagContexts.push({ tag: `@${tag.type}:${tag.value}`, docs: titles });
      }
    }

    const referencedLinksSection =
      linkDocs.length > 0 || missingLinks.length > 0
        ? [
            "Referenced Links:",
            ...linkDocs.map((doc) => `- ${doc.label}: ${doc.excerpt || "No excerpt."}`),
            ...missingLinks.map((label) => `- Missing: ${label}`)
          ].join("\n")
        : null;

    const referencedTagsSection =
      tagContexts.length > 0
        ? [
            "Referenced Tags:",
            ...tagContexts.map((entry) =>
              entry.docs.length > 0
                ? `- ${entry.tag}: ${entry.docs.join(", ")}`
                : `- ${entry.tag}: (no matching docs)`
            )
          ].join("\n")
        : null;

    return [
      "You are a worldbuilding assistant. Stay consistent with the campaign synopsis.",
      "Use existing world context when possible. Keep outputs structured and actionable.",
      `Campaign: ${name}`,
      `Synopsis: ${synopsis}`,
      worldContextSection,
      referencedLinksSection,
      referencedTagsSection,
      "Conversation:",
      ...history,
      `User: ${nextMessage}`,
      "Assistant:"
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleSendAiChat = async () => {
    if (!aiInput.trim()) return;
    const nextMessage = aiInput.trim();
    console.debug("[WB] AI chat send: start", { provider: aiProvider });
    setAiError("");
    setAiSending(true);
    setAiInput("");
    const userEntry = {
      id: createId(),
      role: "user" as const,
      content: nextMessage,
      createdAt: Date.now()
    };
    setAiMessages((prev) => [...prev, userEntry]);
    try {
      const provider = (aiProvider || "none") as AiProvider;
      const [
        openAiKey,
        openAiModel,
        openAiBaseUrl,
        ollamaModel,
        ollamaBaseUrl
      ] = await Promise.all([
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiOllamaModel"),
        getSetting("aiOllamaBaseUrl")
      ]);
      const prompt = await buildChatPrompt(nextMessage);
      console.debug("[WB] AI chat send: prompt built", {
        provider,
        promptLength: prompt.length
      });
      const response = await sendPromptToProvider({
        provider,
        prompt,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      console.debug("[WB] AI chat send: response received", {
        providerLabel: response.providerLabel,
        contentLength: response.content.length
      });
      const assistantEntry = {
        id: createId(),
        role: "assistant" as const,
        content: response.content,
        createdAt: Date.now()
      };
      setAiMessages((prev) => [...prev, assistantEntry]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      console.debug("[WB] AI chat send: error", message);
      setAiError(message);
    } finally {
      console.debug("[WB] AI chat send: done");
      setAiSending(false);
    }
  };

  const handleClearAiChat = () => {
    setAiMessages([]);
    setAiError("");
  };

  return {
    aiProvider,
    setAiProvider,
    aiMessages,
    setAiMessages,
    aiInput,
    setAiInput,
    aiSending,
    aiError,
    handleSendAiChat,
    handleClearAiChat
  };
}
