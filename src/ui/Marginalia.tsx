import type { Doc, Tag, WorldMap } from "../vault/types";
import type { WorldbuildAnchor, WorldbuildResult } from "../ai/worldbuild";
import MarkdownPreview from "./MarkdownPreview";
import MonsterStatBlock from "./MonsterStatBlock";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";
import { usePanelCollapse } from "./usePanelCollapse";
import BacklinksPanel from "./marginalia/BacklinksPanel";
import PrepPanel from "./marginalia/PrepPanel";
import TagsPanel from "./marginalia/TagsPanel";
import WorldbuildPanel from "./marginalia/WorldbuildPanel";
import type { PrepHelpers } from "../prep/helpers";

export type Backlink = {
  source: Doc;
  heading: string | null;
  subheading: string | null;
  line: string;
};

export type MapPin = {
  id?: number;
  mapId: string;
  docId: string;
  x: number;
  y: number;
  createdAt: number;
  map: WorldMap | null;
};

export default function Marginalia({
  backlinks,
  tags,
  onOpenDoc,
  onOpenReference,
  onFilterTag,
  activeTag,
  filteredDocs,
  onClearFilter,
  linkPreview,
  mapPins,
  onOpenMaps,
  npcCreature,
  worldbuildAnchors,
  selectedAnchorIds,
  onToggleWorldbuildAnchor,
  worldbuildTone,
  onWorldbuildToneChange,
  worldbuildResults,
  worldbuildLoading,
  onGeneratePlotLines,
  onBuildCity,
  onGenerateHooks,
  onGenerateHighLevelPlot,
  onBuildPlace,
  onBuildRegion,
  onBuildCountry,
  onBuildTown,
  onBuildVillage,
  onBuildFort,
  onInsertWorldbuildContent,
  onCreateDraftDocs,
  onSendWorldbuild,
  aiProvider,
  aiMessages,
  aiInput,
  aiSending,
  aiError,
  onAiInputChange,
  onSendAiChat,
  onClearAiChat,
  chatLinkDocs,
  chatTagOptions,
  prepHelpers
}: {
  backlinks: Backlink[];
  tags: Tag[];
  onOpenDoc: (docId: string) => void;
  onOpenReference: (slug: string, id: string) => void;
  onFilterTag: (type: string, value: string) => void;
  activeTag: { type: string; value: string } | null;
  filteredDocs: Doc[];
  onClearFilter: () => void;
  linkPreview:
    | { type: "doc"; data: Doc }
    | { type: "reference"; data: { id: string; name: string; content: string; slug: string } }
    | null;
  mapPins: MapPin[];
  onOpenMaps: () => void;
  npcCreature: { name: string; rawJson?: string } | null;
  worldbuildAnchors: WorldbuildAnchor[];
  selectedAnchorIds: string[];
  onToggleWorldbuildAnchor: (anchorId: string) => void;
  worldbuildTone: string;
  onWorldbuildToneChange: (tone: string) => void;
  worldbuildResults: WorldbuildResult[];
  worldbuildLoading: {
    plotLines: boolean;
    cityBuilder: boolean;
    adventureHooks: boolean;
    highLevelPlot: boolean;
    placeBuilder: boolean;
    regionBuilder: boolean;
    countryBuilder: boolean;
    townBuilder: boolean;
    villageBuilder: boolean;
    fortBuilder: boolean;
  };
  onGeneratePlotLines: () => void;
  onBuildCity: () => void;
  onGenerateHooks: () => void;
  onGenerateHighLevelPlot: () => void;
  onBuildPlace: () => void;
  onBuildRegion: () => void;
  onBuildCountry: () => void;
  onBuildTown: () => void;
  onBuildVillage: () => void;
  onBuildFort: () => void;
  onInsertWorldbuildContent: (content: string) => void;
  onCreateDraftDocs: (drafts: NonNullable<WorldbuildResult["drafts"]>) => void;
  onSendWorldbuild: (resultId: string) => void;
  aiProvider: string;
  aiMessages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  aiInput: string;
  aiSending: boolean;
  aiError: string;
  onAiInputChange: (value: string) => void;
  onSendAiChat: () => void;
  onClearAiChat: () => void;
  chatLinkDocs: Array<{ id: string; title: string }>;
  chatTagOptions: Array<{ type: string; value: string }>;
  prepHelpers: PrepHelpers | null;
}) {
  const mapGroups = mapPins.reduce((groups, pin) => {
    if (!pin.map) return groups;
    const existing = groups.get(pin.map.id) ?? { map: pin.map, pins: [] as MapPin[] };
    existing.pins.push(pin);
    groups.set(pin.map.id, existing);
    return groups;
  }, new Map<string, { map: WorldMap; pins: MapPin[] }>());
  const linkPreviewPanel = usePanelCollapse("marginalia-link-preview");
  const mapPinsPanel = usePanelCollapse("marginalia-maps");
  const npcPanel = usePanelCollapse("marginalia-npc");

  return (
    <div id="marginalia" className="space-y-4">
      <WorldbuildPanel
        aiProvider={aiProvider}
        aiMessages={aiMessages}
        aiInput={aiInput}
        aiSending={aiSending}
        aiError={aiError}
        onAiInputChange={onAiInputChange}
        onSendAiChat={onSendAiChat}
        onClearAiChat={onClearAiChat}
        worldbuildTone={worldbuildTone}
        onWorldbuildToneChange={onWorldbuildToneChange}
        worldbuildAnchors={worldbuildAnchors}
        selectedAnchorIds={selectedAnchorIds}
        onToggleWorldbuildAnchor={onToggleWorldbuildAnchor}
        worldbuildLoading={worldbuildLoading}
        onGeneratePlotLines={onGeneratePlotLines}
        onBuildCity={onBuildCity}
        onGenerateHooks={onGenerateHooks}
        onGenerateHighLevelPlot={onGenerateHighLevelPlot}
        onBuildPlace={onBuildPlace}
        onBuildRegion={onBuildRegion}
        onBuildCountry={onBuildCountry}
        onBuildTown={onBuildTown}
        onBuildVillage={onBuildVillage}
        onBuildFort={onBuildFort}
        worldbuildResults={worldbuildResults}
        onSendWorldbuild={onSendWorldbuild}
        onInsertWorldbuildContent={onInsertWorldbuildContent}
        onCreateDraftDocs={onCreateDraftDocs}
        chatLinkDocs={chatLinkDocs}
        chatTagOptions={chatTagOptions}
      />
      <PrepPanel prepHelpers={prepHelpers} />
      {mapGroups.size > 0 && (
        <div id="marginalia-maps" className="page-panel p-4">
          <div className="flex items-center justify-between chapter-divider pb-3">
            <div className="font-display text-lg">Map Pins</div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenMaps}
                className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
                data-tooltip="Open Maps"
              >
                Open
              </button>
              <button
                onClick={mapPinsPanel.toggle}
                aria-label={mapPinsPanel.collapsed ? "Expand panel" : "Minimize panel"}
                className="text-ink-soft hover:text-ember"
              >
                {mapPinsPanel.collapsed ? (
                  <ChevronDownIcon size={14} />
                ) : (
                  <ChevronUpIcon size={14} />
                )}
              </button>
            </div>
          </div>
          {!mapPinsPanel.collapsed && (
            <div className="mt-3 space-y-4">
              {Array.from(mapGroups.values()).map(({ map, pins }) => (
                <div
                  key={map.id}
                  className="rounded-2xl border border-page-edge bg-parchment/80 p-3 space-y-2"
                >
                  <div className="text-sm font-display">{map.name}</div>
                  <div className="relative w-full overflow-hidden rounded-xl border border-page-edge bg-parchment/60">
                    <img
                      src={map.imageDataUrl}
                      alt={map.name}
                      className="block w-full h-auto"
                    />
                    {pins.map((pin) => (
                      <span
                        key={pin.id ?? `${pin.mapId}-${pin.x}-${pin.y}`}
                        className="absolute h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                        style={{
                          left: `${pin.x * 100}%`,
                          top: `${pin.y * 100}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {npcCreature && (
        <div id="marginalia-npc" className="page-panel p-4">
          <div className="flex items-center justify-between chapter-divider pb-3">
            <div className="font-display text-lg">NPC Stat Block</div>
            <button
              onClick={npcPanel.toggle}
              aria-label={npcPanel.collapsed ? "Expand panel" : "Minimize panel"}
              className="text-ink-soft hover:text-ember"
            >
              {npcPanel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
            </button>
          </div>
          {!npcPanel.collapsed && (
            <div className="mt-3">
              <MonsterStatBlock rawJson={npcCreature.rawJson} compact />
            </div>
          )}
        </div>
      )}
      <BacklinksPanel backlinks={backlinks} onOpenDoc={onOpenDoc} />
      <TagsPanel
        tags={tags}
        activeTag={activeTag}
        filteredDocs={filteredDocs}
        onFilterTag={onFilterTag}
        onClearFilter={onClearFilter}
        onOpenDoc={onOpenDoc}
      />
      {linkPreview && (
        <div id="marginalia-link-preview" className="page-panel p-4">
          <div className="flex items-center justify-between chapter-divider pb-3">
            <div className="font-display text-lg">Linked Page Preview</div>
            <button
              onClick={linkPreviewPanel.toggle}
              aria-label={linkPreviewPanel.collapsed ? "Expand panel" : "Minimize panel"}
              className="text-ink-soft hover:text-ember"
            >
              {linkPreviewPanel.collapsed ? (
                <ChevronDownIcon size={14} />
              ) : (
                <ChevronUpIcon size={14} />
              )}
            </button>
          </div>
          {!linkPreviewPanel.collapsed &&
            (linkPreview.type === "doc" ? (
              <>
                <div className="text-sm font-display">{linkPreview.data.title}</div>
                <div className="mt-2 max-h-64 overflow-y-auto pr-2">
                  {linkPreview.data.body ? (
                    <MarkdownPreview
                      content={linkPreview.data.body}
                      onOpenLink={(target) => {
                        if (target.startsWith("doc:")) {
                          onOpenDoc(target.slice(4));
                        }
                      }}
                    />
                  ) : (
                    <div className="marginal-note">No content yet.</div>
                  )}
                </div>
                <button
                  onClick={() => onOpenDoc(linkPreview.data.id)}
                  data-tooltip={`Open ${linkPreview.data.title}`}
                  className="mt-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
                >
                  Open Page
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-display">{linkPreview.data.name}</div>
                <div className="mt-2 max-h-64 overflow-y-auto pr-2">
                  {linkPreview.data.content ? (
                    <MarkdownPreview
                      content={linkPreview.data.content}
                      onOpenLink={(target) => {
                        if (target.startsWith("doc:")) {
                          onOpenDoc(target.slice(4));
                          return;
                        }
                        if (target.startsWith("ref:")) {
                          const parts = target.split(":");
                          if (parts.length >= 3) {
                            onOpenReference(parts[1], parts.slice(2).join(":"));
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="marginal-note">No content yet.</div>
                  )}
                </div>
                <button
                  onClick={() => onOpenReference(linkPreview.data.slug, linkPreview.data.id)}
                  data-tooltip={`Open ${linkPreview.data.name}`}
                  className="mt-3 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember wb-tooltip"
                >
                  Open Reference
                </button>
              </>
            ))}
        </div>
      )}
    </div>
  );
}
