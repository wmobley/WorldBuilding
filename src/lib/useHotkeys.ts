import { useEffect } from "react";

type KeyHandler = (event: KeyboardEvent) => void;

type Hotkey = {
  combo: string;
  handler: KeyHandler;
};

const normalizeCombo = (combo: string) => combo.toLowerCase().replace(/\s+/g, "");

const matchesCombo = (event: KeyboardEvent, combo: string) => {
  const normalized = normalizeCombo(combo);
  const isCmd = normalized.includes("cmd") || normalized.includes("meta");
  const isCtrl = normalized.includes("ctrl");
  const isShift = normalized.includes("shift");
  const isAlt = normalized.includes("alt") || normalized.includes("option");
  const key = normalized.split("+").pop();

  if (isCmd !== (event.metaKey || false)) return false;
  if (isCtrl !== (event.ctrlKey || false)) return false;
  if (isShift !== (event.shiftKey || false)) return false;
  if (isAlt !== (event.altKey || false)) return false;

  if (!key) return false;
  return event.key.toLowerCase() === key;
};

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      hotkeys.forEach(({ combo, handler }) => {
        if (matchesCombo(event, combo)) {
          event.preventDefault();
          handler(event);
        }
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeys]);
}
