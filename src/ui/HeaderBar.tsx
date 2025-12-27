import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign, Doc } from "../vault/types";
import { dmItems, referenceShelf } from "../lib/referenceData";

export default function HeaderBar({
  docs,
  onOpenDoc,
  onNavigateReference,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onCreateCampaign,
  onOpenSettings
}: {
  docs: Doc[];
  onOpenDoc: (docId: string) => void;
  onNavigateReference?: (slug: string) => void;
  campaigns?: Campaign[];
  activeCampaignId?: string | null;
  onSelectCampaign?: (campaignId: string) => void;
  onCreateCampaign?: () => void;
  onOpenSettings?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<"dm" | "ref" | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const activeCampaign = useMemo(
    () => campaigns?.find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );
  const sessionRoomId = activeCampaign?.name?.trim() || "Session";

  useEffect(() => {
    if (!openMenu && !profileOpen) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (profileRef.current && profileRef.current.contains(target)) return;
      setOpenMenu(null);
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu, profileOpen]);

  const matches = useMemo(() => {
    if (!query.trim()) return [] as Doc[];
    const lower = query.toLowerCase();
    return docs.filter((doc) => doc.title.toLowerCase().includes(lower)).slice(0, 6);
  }, [docs, query]);

  return (
    <header
      id="header-bar"
      className="px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="text-2xl font-display tracking-wide text-ink">Worldbuilder</div>
        <div className="text-sm font-ui text-ink-soft uppercase tracking-[0.2em]">
          Spellbook Vault
        </div>
      </div>
      <div className="flex items-center gap-3">
        {campaigns && campaigns.length > 0 && onSelectCampaign && (
          <div className="hidden md:flex items-center gap-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
            <select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (value === "__new__") {
                  onCreateCampaign?.();
                  return;
                }
                onSelectCampaign(value);
              }}
              id="header-campaign-select"
              className="rounded-full border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft"
            >
              <option value="" disabled>
                List of campaigns
              </option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
              <option value="__new__">Create new campaign…</option>
            </select>
          </div>
        )}
        {onNavigateReference && (
          <div
            id="header-nav"
            ref={menuRef}
            className="relative hidden lg:flex items-center gap-2 text-xs font-ui uppercase tracking-[0.2em]"
          >
            <button
              onClick={() => setOpenMenu(openMenu === "dm" ? null : "dm")}
              id="header-nav-dm"
              className="rounded-full border border-page-edge px-3 py-2 text-ink-soft hover:text-ember wb-tooltip"
              data-tooltip="Dungeon Master"
            >
              Dungeon Master
            </button>
            <button
              onClick={() => setOpenMenu(openMenu === "ref" ? null : "ref")}
              id="header-nav-ref"
              className="rounded-full border border-page-edge px-3 py-2 text-ink-soft hover:text-ember wb-tooltip"
              data-tooltip="References"
            >
              References
            </button>
            {openMenu === "dm" && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
                <button
                  onClick={() => {
                    navigate(`/session/${encodeURIComponent(sessionRoomId)}`);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip"
                  data-tooltip="Open interactive video room"
                >
                  Interactive Video Room
                </button>
                <div className="my-1 border-t border-page-edge/60" />
                {dmItems.map((item) => (
                  <button
                    key={item.slug}
                    onClick={() => {
                      onNavigateReference(item.slug);
                      setOpenMenu(null);
                    }}
                    className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip"
                    data-tooltip={`Open ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {openMenu === "ref" && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
                {referenceShelf.map((item) => (
                  <button
                    key={item.slug}
                    onClick={() => {
                      onNavigateReference(item.slug);
                      setOpenMenu(null);
                    }}
                    className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip"
                    data-tooltip={`Open ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the vault by title…"
            id="header-search"
            className="w-64 rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-ui shadow-page"
          />
          {matches.length > 0 && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-page-edge bg-parchment/95 shadow-page z-10">
              {matches.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    onOpenDoc(doc.id);
                    setQuery("");
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-parchment/70 wb-tooltip"
                  data-tooltip={`Open ${doc.title}`}
                >
                  {doc.title}
                </button>
              ))}
            </div>
            )}
        </div>
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((value) => !value)}
            id="header-profile"
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember wb-tooltip"
            data-tooltip="Profile"
          >
            Profile
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
              <button
                onClick={() => {
                  onOpenSettings?.();
                  setProfileOpen(false);
                }}
                className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip"
                data-tooltip="Open settings"
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
