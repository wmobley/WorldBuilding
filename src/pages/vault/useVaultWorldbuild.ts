import { useEffect, useMemo, useState } from "react";
import { createId } from "../../lib/id";
import { buildWorldContext } from "../../prep/context";
import {
  buildWorldbuildContextPreview,
  buildWorldbuildInputs,
  buildWorldbuildPrompt,
  parseWorldbuildDrafts,
  type WorldbuildAnchor,
  type WorldbuildDraft,
  type WorldbuildResult
} from "../../ai/worldbuild";
import { sendPromptToProvider, type AiProvider } from "../../ai/client";
import plotLinesPrompt from "../../ai/prompts/plotLines.md?raw";
import cityBuilderPrompt from "../../ai/prompts/cityBuilder.md?raw";
import adventureHooksPrompt from "../../ai/prompts/adventureHooks.md?raw";
import highLevelPlotPrompt from "../../ai/prompts/highLevelPlot.md?raw";
import placeBuilderPrompt from "../../ai/prompts/placeBuilder.md?raw";
import regionBuilderPrompt from "../../ai/prompts/regionBuilder.md?raw";
import countryBuilderPrompt from "../../ai/prompts/countryBuilder.md?raw";
import townBuilderPrompt from "../../ai/prompts/townBuilder.md?raw";
import villageBuilderPrompt from "../../ai/prompts/villageBuilder.md?raw";
import fortBuilderPrompt from "../../ai/prompts/fortBuilder.md?raw";
import { getSetting } from "../../vault/queries";
import type { Doc, Folder } from "../../vault/types";
import { classifyAnchorType } from "./utils";

type UseVaultWorldbuildInput = {
  currentDoc: Doc | null;
  folders: Folder[];
  worldbuildContext: Awaited<ReturnType<typeof buildWorldContext>> | null;
  aiProvider: string;
  onInsertContent: (content: string) => void;
};

type DraftQueue = {
  drafts: WorldbuildDraft[];
  index: number;
};

const normalizeTag = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) return trimmed;
  if (trimmed.startsWith("#")) return `@${trimmed.slice(1)}`;
  return `@${trimmed}`;
};

const buildDraftBody = (draft: WorldbuildDraft) => {
  const linkLines = draft.linksTo
    .map((link) => link.trim())
    .filter(Boolean)
    .map((link) => `[[${link}]]`);
  const tagLines = draft.tags.map(normalizeTag).filter(Boolean);
  const parts = [draft.bodyMarkdown.trim()].filter(Boolean);
  if (linkLines.length > 0) parts.push(linkLines.join("\n"));
  if (tagLines.length > 0) parts.push(tagLines.join("\n"));
  return parts.join("\n\n");
};

export default function useVaultWorldbuild({
  currentDoc,
  folders,
  worldbuildContext,
  aiProvider,
  onInsertContent
}: UseVaultWorldbuildInput) {
  const [worldbuildTone, setWorldbuildTone] = useState("political intrigue");
  const [selectedAnchorIds, setSelectedAnchorIds] = useState<string[]>([]);
  const [worldbuildResults, setWorldbuildResults] = useState<WorldbuildResult[]>([]);
  const [worldbuildLoading, setWorldbuildLoading] = useState({
    plotLines: false,
    cityBuilder: false,
    adventureHooks: false,
    highLevelPlot: false,
    placeBuilder: false,
    regionBuilder: false,
    countryBuilder: false,
    townBuilder: false,
    villageBuilder: false,
    fortBuilder: false
  });
  const [draftQueue, setDraftQueue] = useState<DraftQueue | null>(null);

  const worldbuildAnchors = useMemo(() => {
    if (!worldbuildContext || folders.length === 0) return [] as WorldbuildAnchor[];
    const folderMap = new Map<string, Folder>(folders.map((folder) => [folder.id, folder]));
    const candidates = [
      ...worldbuildContext.linkedDocs,
      ...worldbuildContext.backlinks,
      ...worldbuildContext.relatedDocsByTag.flatMap((entry) => entry.docs)
    ];
    const unique = new Map<string, WorldbuildAnchor>();
    candidates.forEach((doc) => {
      const type = classifyAnchorType(doc, folderMap);
      if (type === "Other") return;
      if (!unique.has(doc.id)) {
        unique.set(doc.id, { id: doc.id, title: doc.title, type });
      }
    });
    return Array.from(unique.values()).slice(0, 12);
  }, [worldbuildContext, folders]);

  useEffect(() => {
    if (!currentDoc) {
      setSelectedAnchorIds([]);
      setWorldbuildResults([]);
      setDraftQueue(null);
      return;
    }
    setSelectedAnchorIds((prev) => {
      const available = new Set(worldbuildAnchors.map((anchor) => anchor.id));
      const filtered = prev.filter((id) => available.has(id));
      if (filtered.length > 0) return filtered;
      return worldbuildAnchors.slice(0, 4).map((anchor) => anchor.id);
    });
    setWorldbuildResults([]);
    setWorldbuildLoading({
      plotLines: false,
      cityBuilder: false,
      adventureHooks: false,
      highLevelPlot: false,
      placeBuilder: false,
      regionBuilder: false,
      countryBuilder: false,
      townBuilder: false,
      villageBuilder: false,
      fortBuilder: false
    });
    setDraftQueue(null);
  }, [currentDoc?.id, worldbuildAnchors]);

  const toggleWorldbuildAnchor = (anchorId: string) => {
    setSelectedAnchorIds((prev) =>
      prev.includes(anchorId) ? prev.filter((id) => id !== anchorId) : [...prev, anchorId]
    );
  };

  const insertWorldbuildContent = (content: string) => {
    onInsertContent(content);
  };

  const resolveDraftFolderId = (folderHint: WorldbuildDraft["folderHint"]) => {
    if (folders.length === 0) return null;
    if (folderHint === "Other" || folderHint === "World") return null;
    const target = folders.find(
      (folder) => folder.name.toLowerCase() === folderHint.toLowerCase()
    );
    return target?.id ?? null;
  };

  const handleCreateDraftDocs = (drafts: WorldbuildDraft[]) => {
    if (!drafts || drafts.length === 0) return;
    setDraftQueue({ drafts, index: 0 });
  };

  const handleGenerateWorldbuild = async (
    kind: WorldbuildResult["kind"],
    template: string
  ) => {
    if (!currentDoc) return;
    setWorldbuildLoading((prev) => ({ ...prev, [kind]: true }));
    try {
      const context = worldbuildContext ?? (await buildWorldContext(currentDoc.id));
      if (!context) return;
      const selectedAnchors = worldbuildAnchors.filter((anchor) =>
        selectedAnchorIds.includes(anchor.id)
      );
      const anchorsToUse =
        selectedAnchors.length > 0 ? selectedAnchors : worldbuildAnchors.slice(0, 4);
      const inputs = buildWorldbuildInputs(context, anchorsToUse, worldbuildTone);
      const prompt = buildWorldbuildPrompt(template, inputs);
      const drafts = parseWorldbuildDrafts(prompt) ?? undefined;
      const result: WorldbuildResult = {
        id: createId(),
        kind,
        provider:
          aiProvider && aiProvider !== "none"
            ? `Configured: ${aiProvider}`
            : "Template (no AI configured)",
        contextPreview: buildWorldbuildContextPreview(context, anchorsToUse),
        content: prompt,
        createdAt: Date.now(),
        drafts,
        status: "ready"
      };
      // TODO: Connect optional AI provider to execute prompts and store real outputs.
      setWorldbuildResults((prev) => [result, ...prev]);
    } finally {
      setWorldbuildLoading((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const handleSendWorldbuild = async (resultId: string) => {
    setWorldbuildResults((prev) =>
      prev.map((entry) =>
        entry.id === resultId ? { ...entry, status: "sending", error: undefined } : entry
      )
    );
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
      const target = worldbuildResults.find((entry) => entry.id === resultId);
      if (!target) return;
      const response = await sendPromptToProvider({
        provider,
        prompt: target.content,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      setWorldbuildResults((prev) =>
        prev.map((entry) =>
          entry.id === resultId
            ? {
                ...entry,
                content: response.content,
                provider: response.providerLabel,
                status: "ready",
                error: undefined
              }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      setWorldbuildResults((prev) =>
        prev.map((entry) =>
          entry.id === resultId
            ? { ...entry, status: "error", error: message }
            : entry
        )
      );
    }
  };

  return {
    worldbuildAnchors,
    worldbuildTone,
    setWorldbuildTone,
    selectedAnchorIds,
    toggleWorldbuildAnchor,
    worldbuildResults,
    worldbuildLoading,
    handleGeneratePlotLines: () =>
      handleGenerateWorldbuild("plotLines", plotLinesPrompt),
    handleBuildCity: () => handleGenerateWorldbuild("cityBuilder", cityBuilderPrompt),
    handleGenerateHooks: () =>
      handleGenerateWorldbuild("adventureHooks", adventureHooksPrompt),
    handleGenerateHighLevelPlot: () =>
      handleGenerateWorldbuild("highLevelPlot", highLevelPlotPrompt),
    handleBuildPlace: () =>
      handleGenerateWorldbuild("placeBuilder", placeBuilderPrompt),
    handleBuildRegion: () =>
      handleGenerateWorldbuild("regionBuilder", regionBuilderPrompt),
    handleBuildCountry: () =>
      handleGenerateWorldbuild("countryBuilder", countryBuilderPrompt),
    handleBuildTown: () => handleGenerateWorldbuild("townBuilder", townBuilderPrompt),
    handleBuildVillage: () =>
      handleGenerateWorldbuild("villageBuilder", villageBuilderPrompt),
    handleBuildFort: () => handleGenerateWorldbuild("fortBuilder", fortBuilderPrompt),
    insertWorldbuildContent,
    handleCreateDraftDocs,
    handleSendWorldbuild,
    draftQueue,
    activeDraft: draftQueue ? draftQueue.drafts[draftQueue.index] : null,
    resolveDraftFolderId,
    buildDraftBody,
    setDraftQueue
  };
}
