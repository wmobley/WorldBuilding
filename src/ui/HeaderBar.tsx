import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign, Doc } from "../vault/types";
import { dmItems, referenceShelf } from "../lib/referenceData";
import { useAuth } from "../auth/AuthGate";

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
  const { user, signOut } = useAuth();

  const activeCampaign = useMemo(
    () => campaigns?.find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );
  const singleCampaign = (campaigns?.length ?? 0) === 1 ? campaigns?.[0] ?? null : null;
  const subtitle = singleCampaign?.name ?? activeCampaign?.name ?? "Spellbook Vault";
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
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-2xl font-display tracking-wide text-ink hover:text-ember transition"
        >
          Worldbuilder
        </button>
        <div className="flex items-center gap-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
          {onSelectCampaign ? (
            <label
              htmlFor="header-campaign-select"
              className="wb-tooltip wb-tooltip--down"
              data-tooltip="Switch active world."
            >
              <span className="sr-only">World</span>
              <select
                value={activeCampaignId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "__new__") {
                    onCreateCampaign?.();
                    return;
                  }
                  onSelectCampaign(value);
                }}
                id="header-campaign-select"
                aria-label="Select world"
                className="rounded-full border border-page-edge bg-parchment/80 px-3 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft"
              >
                <option value="" disabled>
                  {campaigns && campaigns.length > 0
                    ? "Select a world"
                    : "No worlds"}
                </option>
                {(campaigns ?? []).map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
                <option value="__new__">Create new world…</option>
              </select>
            </label>
          ) : (
            <span>{subtitle}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onNavigateReference && (
          <div
            id="header-nav"
            ref={menuRef}
            className="relative hidden lg:flex items-center gap-2 text-xs font-ui uppercase tracking-[0.2em]"
          >
            <button
              onClick={() => setOpenMenu(openMenu === "dm" ? null : "dm")}
              id="header-nav-dm"
              className="rounded-full border border-page-edge px-3 py-2 text-ink-soft hover:text-ember wb-tooltip wb-tooltip--down"
              data-tooltip="Dungeon Master"
            >
              Dungeon Master
            </button>
            <button
              onClick={() => setOpenMenu(openMenu === "ref" ? null : "ref")}
              id="header-nav-ref"
              className="rounded-full border border-page-edge px-3 py-2 text-ink-soft hover:text-ember wb-tooltip wb-tooltip--down"
              data-tooltip="References"
            >
              References
            </button>
            {openMenu === "dm" && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
                <button
                  onClick={() => {
                    navigate(`/session?name=${encodeURIComponent(sessionRoomId)}`);
                    setOpenMenu(null);
                  }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip wb-tooltip--down"
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
                    className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip wb-tooltip--down"
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
                    className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip wb-tooltip--down"
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
          <label
            htmlFor="header-search"
            className="wb-tooltip wb-tooltip--down"
            data-tooltip="Search page titles in this world."
          >
            <span className="sr-only">Search pages</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the vault by title…"
              id="header-search"
              aria-label="Search pages"
              className="w-64 rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-ui shadow-page"
            />
          </label>
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
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember wb-tooltip wb-tooltip--down"
            data-tooltip="Profile"
          >
            Profile
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-page-edge bg-parchment/95 shadow-page p-2 z-10">
              {user?.email && (
                <div className="px-3 py-2 text-[10px] font-ui uppercase tracking-[0.2em] text-ink-soft">
                  {user.email}
                </div>
              )}
              <button
                onClick={() => {
                  onOpenSettings?.();
                  setProfileOpen(false);
                }}
                className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip wb-tooltip--down"
                data-tooltip="Open settings"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  signOut().catch(() => undefined);
                  setProfileOpen(false);
                }}
                className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-parchment/70 wb-tooltip wb-tooltip--down"
                data-tooltip="Sign out"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
