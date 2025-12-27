import type { Campaign } from "../vault/types";
import { usePanelCollapse } from "./usePanelCollapse";
import { ChevronDownIcon, ChevronUpIcon } from "@primer/octicons-react";

export default function CampaignPanel({
  activeCampaign,
  viewMode,
  onSelectView,
  onCreateCampaign,
  onUpdateCampaign,
  onOpenSettings
}: {
  activeCampaign: Campaign | null;
  viewMode: "worldview" | "timeline" | "maps";
  onSelectView: (view: "worldview" | "timeline" | "maps") => void;
  onCreateCampaign: () => void;
  onUpdateCampaign: (campaignId: string, updates: Partial<Campaign>) => void;
  onOpenSettings?: (campaignId: string) => void;
}) {
  const campaignPanel = usePanelCollapse("campaign-panel");
  return (
    <div id="campaign-panel" className="page-panel p-4">
      <div className="flex items-center justify-between chapter-divider pb-3">
        <div className="font-display text-lg">Campaign</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateCampaign}
            id="campaign-new"
            className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember wb-tooltip"
            data-tooltip="Create campaign"
          >
            New
          </button>
          <button
            onClick={campaignPanel.toggle}
            aria-label={campaignPanel.collapsed ? "Expand panel" : "Minimize panel"}
            className="text-ink-soft hover:text-ember"
          >
            {campaignPanel.collapsed ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
          </button>
        </div>
      </div>
      {!campaignPanel.collapsed && (
        <div className="mt-3 space-y-3">
          <select
            value={viewMode}
            onChange={(event) =>
              onSelectView(event.target.value as "worldview" | "timeline" | "maps")
            }
            id="campaign-select"
            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
          >
            <option value="worldview">Worldview</option>
            <option value="timeline">Timeline</option>
            <option value="maps">Maps</option>
          </select>
          {activeCampaign && (
            <>
              <input
                value={activeCampaign.name}
                onChange={(event) =>
                  onUpdateCampaign(activeCampaign.id, { name: event.target.value })
                }
                id="campaign-name"
                className="w-full text-xl font-display bg-transparent focus:outline-none"
              />
              <textarea
                value={activeCampaign.synopsis}
                onChange={(event) =>
                  onUpdateCampaign(activeCampaign.id, { synopsis: event.target.value })
                }
                placeholder="Write the campaign synopsis..."
                id="campaign-synopsis"
                className="w-full min-h-[120px] rounded-xl border border-page-edge bg-parchment/70 p-3 text-sm font-body"
              />
              {onOpenSettings && (
                <button
                  onClick={() => onOpenSettings(activeCampaign.id)}
                  className="w-full rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                >
                  Campaign Settings
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
