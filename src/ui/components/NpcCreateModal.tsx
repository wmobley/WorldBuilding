import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";

export type NpcCreatureOption = {
  id: string;
  name: string;
  source: string;
};

export default function NpcCreateModal({
  isOpen,
  creatures,
  onClose,
  onCreate,
  initialCreatureId
}: {
  isOpen: boolean;
  creatures: NpcCreatureOption[];
  onClose: () => void;
  onCreate: (title: string, creatureId: string | null) => void;
  initialCreatureId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [creatureId, setCreatureId] = useState<string>("none");
  const sortedCreatures = useMemo(
    () => creatures.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [creatures]
  );

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setCreatureId(initialCreatureId ?? "none");
  }, [initialCreatureId, isOpen]);

  return (
    <Modal isOpen={isOpen} title="Create NPC" onClose={onClose}>
      <div className="space-y-2">
        <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
          NPC name
        </label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Name this NPC"
          className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
          Base creature
        </label>
        <select
          value={creatureId}
          onChange={(event) => setCreatureId(event.target.value)}
          className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-ui"
        >
          <option value="none">No base creature</option>
          {sortedCreatures.map((creature) => (
            <option key={creature.id} value={creature.id}>
              {creature.name} · {creature.source}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
        >
          Cancel
        </button>
        <button
          onClick={() => onCreate(title, creatureId === "none" ? null : creatureId)}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
        >
          Create NPC
        </button>
      </div>
    </Modal>
  );
}
