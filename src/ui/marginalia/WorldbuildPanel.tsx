import type { WorldbuildAnchor, WorldbuildResult } from "../../ai/worldbuild";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "../usePanelCollapse";

function formatWorldbuildKind(kind: WorldbuildResult["kind"]) {
  switch (kind) {
    case "plotLines":
      return "Plot Lines";
    case "highLevelPlot":
      return "High-Level Plot";
    case "cityBuilder":
      return "City Builder";
    case "adventureHooks":
      return "Adventure Hooks";
    default:
      return "Worldbuild";
  }
}

export default function WorldbuildPanel({
  aiProvider,
  aiMessages,
  aiInput,
  aiSending,
  aiError,
  onAiInputChange,
  onSendAiChat,
  onClearAiChat,
  worldbuildTone,
  onWorldbuildToneChange,
  worldbuildAnchors,
  selectedAnchorIds,
  onToggleWorldbuildAnchor,
  worldbuildLoading,
  onGeneratePlotLines,
  onBuildCity,
  onGenerateHooks,
  onGenerateHighLevelPlot,
  worldbuildResults,
  onSendWorldbuild,
  onInsertWorldbuildContent,
  onCreateDraftDocs,
  chatLinkDocs,
  chatTagOptions
}: {
  aiProvider: string;
  aiMessages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  aiInput: string;
  aiSending: boolean;
  aiError: string;
  onAiInputChange: (value: string) => void;
  onSendAiChat: () => void;
  onClearAiChat: () => void;
  worldbuildTone: string;
  onWorldbuildToneChange: (tone: string) => void;
  worldbuildAnchors: WorldbuildAnchor[];
  selectedAnchorIds: string[];
  onToggleWorldbuildAnchor: (anchorId: string) => void;
  worldbuildLoading: {
    plotLines: boolean;
    cityBuilder: boolean;
    adventureHooks: boolean;
    highLevelPlot: boolean;
  };
  onGeneratePlotLines: () => void;
  onBuildCity: () => void;
  onGenerateHooks: () => void;
  onGenerateHighLevelPlot: () => void;
  worldbuildResults: WorldbuildResult[];
  onSendWorldbuild: (resultId: string) => void;
  onInsertWorldbuildContent: (content: string) => void;
  onCreateDraftDocs: (drafts: NonNullable<WorldbuildResult["drafts"]>) => void;
  chatLinkDocs: Array<{ id: string; title: string }>;
  chatTagOptions: Array<{ type: string; value: string }>;
}) {
  const panel = usePanelCollapse("marginalia-worldbuild");
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const linkQuery = (() => {
    const lastOpen = aiInput.lastIndexOf("[[");
    const lastClose = aiInput.lastIndexOf("]]");
    if (lastOpen === -1 || lastOpen < lastClose) return null;
    const tail = aiInput.slice(lastOpen + 2);
    if (tail.includes("]]")) return null;
    const query = tail.split("|")[0].trim();
    return query;
  })();

  const tagQuery = (() => {
    const tailStart = Math.max(aiInput.lastIndexOf(" "), aiInput.lastIndexOf("\n"));
    const tail = aiInput.slice(tailStart + 1);
    if (!tail.startsWith("@")) return null;
    const match = /^@([a-zA-Z]*)(?::([\w-]*))?$/.exec(tail);
    if (!match) return null;
    return { type: match[1] ?? "", value: match[2] ?? "", tailStart };
  })();

  const linkSuggestions =
    linkQuery === null
      ? []
      : chatLinkDocs
          .filter((doc) => {
            const query = normalize(linkQuery);
            const title = normalize(doc.title);
            if (!query) return true;
            return title.startsWith(query) || title.includes(query);
          })
          .slice(0, 8);

  const tagSuggestions =
    tagQuery === null
      ? []
      : chatTagOptions
          .filter((tag) => {
            const typeMatch = tag.type.toLowerCase().startsWith(tagQuery.type.toLowerCase());
            const valueMatch = tag.value
              .toLowerCase()
              .startsWith(tagQuery.value.toLowerCase());
            return typeMatch && valueMatch;
          })
          .slice(0, 8);

  const applyLinkSuggestion = (title: string) => {
    const lastOpen = aiInput.lastIndexOf("[[");
    if (lastOpen === -1) {
      onAiInputChange(`${aiInput}${aiInput.endsWith(" ") || !aiInput ? "" : " "}[[${title}]]`);
      return;
    }
    onAiInputChange(`${aiInput.slice(0, lastOpen + 2)}${title}]]`);
  };

  const applyTagSuggestion = (type: string, value: string) => {
    if (!tagQuery) return;
    const before = aiInput.slice(0, tagQuery.tailStart + 1);
    onAiInputChange(`${before}@${type}:${value}`);
  };

  return (
    <div id="marginalia-worldbuild" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Worldbuild</div>
        <button
          onClick={panel.toggle}
          aria-label={panel.collapsed ? "Expand panel" : "Minimize panel"}
          className="text-ink-soft hover:text-ember"
        >
          {panel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
        </button>
      </div>
      {!panel.collapsed && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Provider: {aiProvider && aiProvider !== "none" ? aiProvider : "none"}
            </div>
            <div className="grid gap-3">
              <div>
                <label className="text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Tone
                </label>
                <select
                  value={worldbuildTone}
                  onChange={(event) => onWorldbuildToneChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
                >
                  <option value="political intrigue">Political intrigue</option>
                  <option value="horror">Horror</option>
                  <option value="exploration">Exploration</option>
                  <option value="mythic">Mythic</option>
                  <option value="war">War</option>
                  <option value="mystery">Mystery</option>
                  <option value="survival">Survival</option>
                  <option value="court drama">Court drama</option>
                  <option value="frontier">Frontier</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Worldbuild Action
                </label>
                <select
                  value="__placeholder"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "high") onGenerateHighLevelPlot();
                    if (value === "plot") onGeneratePlotLines();
                    if (value === "city") onBuildCity();
                    if (value === "hooks") onGenerateHooks();
                    event.target.value = "__placeholder";
                  }}
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui"
                >
                  <option value="__placeholder">Select action...</option>
                  <option value="high">
                    {worldbuildLoading.highLevelPlot
                      ? "Generating..."
                      : "High-Level Plot"}
                  </option>
                  <option value="plot">
                    {worldbuildLoading.plotLines ? "Generating..." : "Generate Plot Lines"}
                  </option>
                  <option value="city">
                    {worldbuildLoading.cityBuilder ? "Generating..." : "Build a City"}
                  </option>
                  <option value="hooks">
                    {worldbuildLoading.adventureHooks ? "Generating..." : "Generate Hooks"}
                  </option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em]">
                <button
                  onClick={onClearAiChat}
                  className="rounded-full border border-page-edge px-3 py-1 text-ink-soft hover:text-ember"
                >
                  Clear Chat
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-page-edge bg-parchment/70 p-3 max-h-64 overflow-y-auto space-y-3">
              {aiMessages.length === 0 ? (
                <p className="marginal-note">
                  Ask for high-level world structure and the assistant will use the campaign
                  synopsis as context.
                </p>
              ) : (
                aiMessages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <div className="text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                      {message.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))
              )}
            </div>
            {aiError && <div className="text-xs font-ui text-ember">{aiError}</div>}
            <div className="flex flex-col gap-2">
              <textarea
                value={aiInput}
                onChange={(event) => onAiInputChange(event.target.value)}
                placeholder="Ask for world pillars, factions, regions, themes..."
                className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-body min-h-[90px]"
              />
              {(linkSuggestions.length > 0 || tagSuggestions.length > 0) && (
                <div className="rounded-xl border border-page-edge bg-parchment/70 p-2">
                  <div className="text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                    Suggestions
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {linkSuggestions.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => applyLinkSuggestion(doc.title)}
                        className="rounded-full border border-page-edge px-3 py-1 text-[11px] font-ui text-ink-soft hover:text-ember"
                      >
                        [[{doc.title}]]
                      </button>
                    ))}
                    {tagSuggestions.map((tag) => (
                      <button
                        key={`${tag.type}:${tag.value}`}
                        onClick={() => applyTagSuggestion(tag.type, tag.value)}
                        className="rounded-full border border-page-edge px-3 py-1 text-[11px] font-ui text-ink-soft hover:text-ember"
                      >
                        @{tag.type}:{tag.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                  Uses campaign synopsis automatically.
                </div>
                <button
                  onClick={() => onSendAiChat()}
                  disabled={aiSending || !aiInput.trim()}
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember disabled:opacity-60"
                >
                  {aiSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                Anchors
              </div>
              {worldbuildAnchors.length === 0 ? (
                <p className="marginal-note mt-2">No anchors surfaced yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {worldbuildAnchors.map((anchor) => (
                    <label
                      key={anchor.id}
                      className="flex items-center justify-between gap-2 text-xs text-ink-soft"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedAnchorIds.includes(anchor.id)}
                          onChange={() => onToggleWorldbuildAnchor(anchor.id)}
                          className="rounded border-page-edge text-ember"
                        />
                        <span className="text-ink">{anchor.title}</span>
                      </span>
                      <span className="text-[10px] font-ui uppercase tracking-[0.18em]">
                        {anchor.type}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {worldbuildResults.length === 0 ? (
              <p className="marginal-note">
                Run a worldbuild action to assemble a prompt package.
              </p>
            ) : (
              worldbuildResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-2xl border border-page-edge bg-parchment/70 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-display">
                      {formatWorldbuildKind(result.kind)}
                    </div>
                    <div className="text-[10px] font-ui uppercase tracking-[0.18em] text-ink-soft">
                      {result.provider}
                    </div>
                  </div>
                  <div className="marginal-note">Context: {result.contextPreview}</div>
                  {result.status === "error" && result.error && (
                    <div className="text-xs font-ui text-ember">{result.error}</div>
                  )}
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-page-edge bg-parchment/80 p-2 text-xs font-ui whitespace-pre-wrap">
                    {result.content}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-ui uppercase tracking-[0.18em]">
                    <button
                      onClick={() => onSendWorldbuild(result.id)}
                      disabled={result.status === "sending"}
                      className="text-ink-soft hover:text-ember disabled:opacity-60"
                    >
                      {result.status === "sending" ? "Sending..." : "Send to AI"}
                    </button>
                    <button
                      onClick={() => onInsertWorldbuildContent(result.content)}
                      className="text-ink-soft hover:text-ember"
                    >
                      Insert into Page
                    </button>
                    {result.drafts && result.drafts.length > 0 && (
                      <button
                        onClick={() => onCreateDraftDocs(result.drafts)}
                        className="text-ink-soft hover:text-ember"
                      >
                        Create Draft Docs...
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
