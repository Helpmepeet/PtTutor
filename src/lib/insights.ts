import type {
  InsightFlashcard,
  InsightsSummary,
  MarkerCategory,
  MarkerSeverity,
  MarkerStat,
  ReviewerOutput
} from "./types";

export type InsightRow = {
  content: string;
  reviewer_output: ReviewerOutput;
  scenario_name: string;
};

const CATEGORY_ORDER: MarkerCategory[] = [
  "grammar",
  "word_choice",
  "preposition",
  "tone",
  "style"
];

const SEVERITY_ORDER: MarkerSeverity[] = ["major", "minor", "suggestion"];

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function aggregateInsights(rows: InsightRow[]): InsightsSummary {
  const by_category = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, 0])
  ) as Record<MarkerCategory, number>;
  const by_severity = Object.fromEntries(
    SEVERITY_ORDER.map((severity) => [severity, 0])
  ) as Record<MarkerSeverity, number>;
  const fixGroups = new Map<string, MarkerStat>();
  const flashcards: InsightFlashcard[] = [];
  let clean_count = 0;
  let total_markers = 0;

  rows.forEach((row, messageIndex) => {
    if (row.reviewer_output.markers.length === 0) {
      clean_count += 1;
      return;
    }

    for (const marker of row.reviewer_output.markers) {
      by_category[marker.category] += 1;
      by_severity[marker.severity] += 1;
      total_markers += 1;

      const key = `${normalize(marker.wrong)}→${normalize(marker.fix)}`;
      const existing = fixGroups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        fixGroups.set(key, {
          wrong: marker.wrong,
          fix: marker.fix,
          category: marker.category,
          severity: marker.severity,
          count: 1,
          sample_sentence: row.content,
          scenario_name: row.scenario_name
        });
      }

      if (row.content.includes(marker.span_text)) {
        flashcards.push({
          id: `${messageIndex}:${marker.id}`,
          sentence: row.content,
          span_text: marker.span_text,
          fix: marker.fix,
          why: marker.why,
          category: marker.category,
          scenario_name: row.scenario_name
        });
      }
    }
  });

  return {
    messages_reviewed: rows.length,
    clean_count,
    total_markers,
    by_category,
    by_severity,
    top_fixes: [...fixGroups.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    flashcards: [...flashcards].reverse().slice(0, 60)
  };
}
