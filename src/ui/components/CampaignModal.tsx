import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function CampaignModal({
  isOpen,
  onClose,
  onCreate
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, synopsis: string) => void;
}) {
  const [name, setName] = useState("");
  const [synopsis, setSynopsis] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setSynopsis("");
  }, [isOpen]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, synopsis.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Create Campaign" onClose={onClose}>
      <label
        className="space-y-2 block text-sm font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
        data-tooltip="The name shown in the header and invitations."
      >
        <span>Campaign name</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Campaign name"
          className="w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-body text-ink"
        />
      </label>
      <label
        className="space-y-2 block text-sm font-ui uppercase tracking-[0.18em] text-ink-soft wb-tooltip"
        data-tooltip="Short pitch used by worldbuild prompts."
      >
        <span>Synopsis</span>
        <textarea
          value={synopsis}
          onChange={(event) => setSynopsis(event.target.value)}
          placeholder="Short synopsis..."
          className="w-full min-h-[120px] rounded-xl border border-page-edge bg-parchment/70 px-4 py-2 text-sm font-body text-ink"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
