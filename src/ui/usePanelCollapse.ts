import { useEffect, useState } from "react";

export function usePanelCollapse(panelId: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`wb:panel:${panelId}`);
    if (!stored) return;
    setCollapsed(stored === "collapsed");
  }, [panelId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `wb:panel:${panelId}`,
      collapsed ? "collapsed" : "expanded"
    );
  }, [collapsed, panelId]);

  const toggle = () => setCollapsed((prev) => !prev);

  return { collapsed, toggle, setCollapsed };
}
