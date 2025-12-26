import { parseMonster, renderEntries } from "../lib/monster";

type MonsterStatBlockProps = {
  rawJson?: string;
  compact?: boolean;
  onCreateNpc?: () => void;
};

export default function MonsterStatBlock({
  rawJson,
  compact = false,
  onCreateNpc
}: MonsterStatBlockProps) {
  const monster = parseMonster(rawJson);
  if (!monster) {
    return (
      <div className="rounded-2xl border border-page-edge bg-parchment/70 p-4 text-sm text-ink-soft">
        No stat block data available.
      </div>
    );
  }

  const renderSection = (title: string, entries: { name?: string; entries?: unknown }[]) => {
    if (entries.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
          {title}
        </div>
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const body = renderEntries(entry.entries);
            const paragraphs = body.split(/\n\n+/).filter(Boolean);
            return (
              <div key={`${title}-${index}`} className="text-sm font-body text-ink">
                {entry.name && (
                  <span className="font-semibold text-ink">{entry.name}. </span>
                )}
                {paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${title}-${index}-${paragraphIndex}`} className="mt-1 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-page-edge bg-parchment/80 p-6 shadow-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="text-2xl font-display">{monster.name}</div>
          {onCreateNpc && !compact && (
            <button
              onClick={onCreateNpc}
              className="rounded-full border border-page-edge px-3 py-1 text-[11px] font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
            >
              Create NPC
            </button>
          )}
        </div>
        <div className="text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
          {monster.size} {monster.type}, {monster.alignment}
        </div>
      </div>
      <div className="mt-4 border-t border-page-edge pt-4 space-y-3 text-sm font-body">
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="font-semibold">Armor Class</span> {monster.ac}
          </div>
          <div>
            <span className="font-semibold">Hit Points</span> {monster.hp}
          </div>
          <div>
            <span className="font-semibold">Speed</span> {monster.speed}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-page-edge bg-parchment/60 p-3 text-center text-xs font-ui uppercase tracking-[0.18em]">
          {(["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => (
            <div key={ability} className="space-y-1">
              <div className="text-ink-soft">{ability}</div>
              <div className="text-sm font-display text-ink">
                {monster.abilities[ability]}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm">
          <div>
            <span className="font-semibold">Skills</span> {monster.skills}
          </div>
          <div>
            <span className="font-semibold">Senses</span> {monster.senses}
          </div>
          <div>
            <span className="font-semibold">Languages</span> {monster.languages}
          </div>
          <div>
            <span className="font-semibold">Challenge</span> {monster.cr}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {renderSection("Traits", monster.traits)}
        {renderSection("Actions", monster.actions)}
        {renderSection("Bonus Actions", monster.bonusActions)}
        {renderSection("Reactions", monster.reactions)}
        {renderSection("Legendary Actions", monster.legendaryActions)}
        {renderSection("Mythic Actions", monster.mythicActions)}
      </div>
      {compact && <div className="mt-4 text-[11px] text-ink-soft">Stat block preview.</div>}
    </div>
  );
}
