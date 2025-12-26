import { useEffect } from "react";
import type { ReactNode } from "react";

export default function Modal({
  isOpen,
  title,
  onClose,
  children
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg page-panel p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="chapter-divider pb-3 text-lg font-display">{title}</div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
