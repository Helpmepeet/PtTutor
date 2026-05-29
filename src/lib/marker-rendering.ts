import type { ReviewMarker } from "./types";

export type MarkedSegment = {
  text: string;
  marker: ReviewMarker | null;
};

export function buildMarkedSegments(
  text: string,
  markers: ReviewMarker[]
): MarkedSegment[] {
  const positioned = markers
    .map((marker) => {
      const start = text.indexOf(marker.span_text);
      return {
        marker,
        start,
        end: start + marker.span_text.length
      };
    })
    .filter((marker) => marker.start >= 0)
    .sort((a, b) => a.start - b.start);

  const segments: MarkedSegment[] = [];
  let cursor = 0;

  for (const item of positioned) {
    if (item.start > cursor) {
      segments.push({ text: text.slice(cursor, item.start), marker: null });
    }
    segments.push({ text: text.slice(item.start, item.end), marker: item.marker });
    cursor = item.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), marker: null });
  }

  return segments.length > 0 ? segments : [{ text, marker: null }];
}
