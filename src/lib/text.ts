export function extractSnippet(content: string, marker: string, radius = 60) {
  const index = content.toLowerCase().indexOf(marker.toLowerCase());
  if (index === -1) {
    return content.slice(0, radius * 2).trim();
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + marker.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

export function extractBacklinkContext(content: string, marker: string) {
  const lines = content.split("\n");
  let heading: string | null = null;
  let subheading: string | null = null;
  let matchLine: string | null = null;

  const normalizedMarker = marker.toLowerCase();

  for (const rawLine of lines) {
    const line = rawLine.replace(/<!--[\s\S]*?-->/g, "").trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      heading = line.slice(2).trim();
      subheading = null;
      continue;
    }
    if (line.startsWith("## ")) {
      subheading = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("### ")) {
      subheading = line.slice(4).trim();
      continue;
    }

    if (line.toLowerCase().includes(normalizedMarker)) {
      matchLine = line;
      break;
    }
  }

  if (!matchLine) {
    const firstLine = lines.find((line) => line.trim().length > 0);
    matchLine = firstLine?.trim() ?? "";
  }

  return { heading, subheading, line: matchLine };
}

export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const diff = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const minutes = Math.round(diff / minute);
    return `${minutes} min ago`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diff < week) {
    const days = Math.round(diff / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (diff < month) {
    const weeks = Math.round(diff / week);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (diff < year) {
    const months = Math.round(diff / month);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.round(diff / year);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
