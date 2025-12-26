import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function PromptModal({
  isOpen,
  title,
  label,
  placeholder,
  initialValue,
  confirmLabel = "Create",
  onConfirm,
  onClose
}: {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue ?? "");
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <label className="space-y-2 block text-sm font-ui uppercase tracking-[0.18em] text-ink-soft">
        <span>{label}</span>
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-body text-ink"
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
          onClick={handleConfirm}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
