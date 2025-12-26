import Modal from "./Modal";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <p className="marginal-note">{message}</p>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
