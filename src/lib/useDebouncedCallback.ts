import { useMemo, useRef } from "react";

type Debounced<T extends (...args: never[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number
): Debounced<T> {
  const timeoutRef = useRef<number | null>(null);

  return useMemo(() => {
    const debounced = (...args: Parameters<T>) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        callback(...args);
      }, delay);
    };

    debounced.cancel = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };

    return debounced as Debounced<T>;
  }, [callback, delay]);
}
