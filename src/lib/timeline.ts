import type { Doc } from "../vault/types";

export type TimelineEntry = {
  id: string;
  docId: string;
  docTitle: string;
  heading: string;
  tagType: "timeline" | "plot" | "subplot";
  tagValue: string;
  timeTag?: string;
  timeKey?: number;
  line: string;
  lineIndex: number;
};

const tagPattern = /@(timeline|plot|subplot):([\w-]+)/gi;
const timePattern = /@time:(\d{4}):(\d{2}):(\d{2})/;

const toTimeKey = (day: number, hour: number, minute: number) =>
  day * 24 * 60 + hour * 60 + minute;

export function extractTimelineEntries(doc: Doc): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const lines = doc.body.split("\n");
  let currentHeading = doc.title;

  lines.forEach((line, index) => {
    const headingMatch = /^(#{1,4})\s+(.*)/.exec(line.trim());
    if (headingMatch) {
      currentHeading = headingMatch[2]?.trim() || currentHeading;
    }

    let timeTag: string | undefined;
    let timeKey: number | undefined;
    const matches = Array.from(line.matchAll(tagPattern));
    if (matches.length === 0) return;

    const timeMatch = line.match(timePattern);
    if (timeMatch) {
      const day = Number(timeMatch[1]);
      const hour = Number(timeMatch[2]);
      const minute = Number(timeMatch[3]);
      if (
        Number.isFinite(day) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        hour >= 0 &&
        hour < 24 &&
        minute >= 0 &&
        minute < 60
      ) {
        timeTag = `@time:${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
        timeKey = toTimeKey(day, hour, minute);
      }
    }

    for (const match of matches) {
      const tagType = match[1]?.toLowerCase() as TimelineEntry["tagType"];
      const tagValue = match[2]?.toLowerCase();
      if (!tagType || !tagValue) continue;
      const cleaned = line
        .replace(tagPattern, "")
        .replace(/@time:\d{4}:\d{2}:\d{2}/g, "")
        .replace(/\s+/g, " ")
        .trim();
      entries.push({
        id: `${doc.id}:${index}:${tagType}:${tagValue}`,
        docId: doc.id,
        docTitle: doc.title,
        heading: currentHeading,
        tagType,
        tagValue,
        timeTag,
        timeKey,
        line: cleaned || line.trim(),
        lineIndex: index
      });
      if (entries.length > 5000) return;
    }
  });

  return entries;
}

export function buildTimelineEntries(docs: Doc[]): TimelineEntry[] {
  return docs.flatMap((doc) => extractTimelineEntries(doc));
}
