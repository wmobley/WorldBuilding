import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function AppShell({
  header,
  sidebar,
  page,
  marginalia
}: {
  header: ReactNode;
  sidebar: ReactNode;
  page: ReactNode;
  marginalia?: ReactNode;
}) {
  const hasMarginalia = Boolean(marginalia);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef<"sidebar" | "marginalia" | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dividerSize = 12;
  const minPageWidth = 520;
  const sidebarBounds = { min: 220, max: 420 };
  const marginaliaBounds = { min: 220, max: 360 };

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 260;
    const stored = window.localStorage.getItem("paneWidths");
    if (!stored) return 260;
    try {
      const parsed = JSON.parse(stored) as { sidebar?: number };
      if (typeof parsed.sidebar === "number") return parsed.sidebar;
    } catch {
      return 260;
    }
    return 260;
  });
  const [marginaliaWidth, setMarginaliaWidth] = useState(() => {
    if (typeof window === "undefined") return 280;
    const stored = window.localStorage.getItem("paneWidths");
    if (!stored) return 280;
    try {
      const parsed = JSON.parse(stored) as { marginalia?: number };
      if (typeof parsed.marginalia === "number") return parsed.marginalia;
    } catch {
      return 280;
    }
    return 280;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "paneWidths",
      JSON.stringify({ sidebar: sidebarWidth, marginalia: marginaliaWidth })
    );
  }, [sidebarWidth, marginaliaWidth]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const layout = layoutRef.current;
      const target = resizingRef.current;
      if (!layout || !target) return;
      const rect = layout.getBoundingClientRect();
      const totalDivider = hasMarginalia ? dividerSize * 2 : dividerSize;
      if (target === "sidebar") {
        const raw = event.clientX - rect.left;
        const available =
          rect.width - totalDivider - (hasMarginalia ? marginaliaWidth : 0);
        const max = Math.min(sidebarBounds.max, Math.max(0, available - minPageWidth));
        const next = Math.min(Math.max(raw, sidebarBounds.min), max);
        setSidebarWidth(next);
      } else if (target === "marginalia") {
        const raw = rect.right - event.clientX;
        const available = rect.width - totalDivider - sidebarWidth;
        const max = Math.min(
          marginaliaBounds.max,
          Math.max(0, available - minPageWidth)
        );
        const next = Math.min(Math.max(raw, marginaliaBounds.min), max);
        setMarginaliaWidth(next);
      }
    };

    const handleUp = () => {
      resizingRef.current = null;
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dividerSize, hasMarginalia, isResizing, marginaliaWidth, sidebarWidth]);

  const layoutStyle = useMemo(
    () =>
      ({
        "--sidebar-width": `${sidebarWidth}px`,
        "--marginalia-width": `${marginaliaWidth}px`,
        "--pane-divider-size": `${dividerSize}px`
      }) as CSSProperties,
    [dividerSize, marginaliaWidth, sidebarWidth]
  );

  const startResize = (target: "sidebar" | "marginalia") => {
    resizingRef.current = target;
    setIsResizing(true);
  };

  return (
    <div id="app-shell" className="min-h-screen text-ink">
      <div
        id="app-header"
        className="sticky top-0 z-20 bg-parchment/80 backdrop-blur-sm border-b border-page-edge"
      >
        {header}
      </div>
      <div
        id="app-layout"
        ref={layoutRef}
        data-has-marginalia={hasMarginalia}
        data-resizing={isResizing ? "true" : "false"}
        style={layoutStyle}
        className="grid grid-cols-1 gap-6 px-6 py-6 lg:gap-0"
      >
        <aside id="app-sidebar" className="space-y-4">
          {sidebar}
        </aside>
        <div className="hidden lg:flex items-stretch justify-center">
          <button
            type="button"
            aria-label="Resize sidebar"
            onMouseDown={() => startResize("sidebar")}
            className="pane-divider"
          />
        </div>
        <main id="app-page" className="min-h-[60vh]">
          {page}
        </main>
        {hasMarginalia && (
          <>
            <div className="hidden lg:flex items-stretch justify-center">
              <button
                type="button"
                aria-label="Resize marginalia"
                onMouseDown={() => startResize("marginalia")}
                className="pane-divider"
              />
            </div>
            <aside id="app-marginalia" className="space-y-4">
              {marginalia}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
