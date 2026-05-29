import { z } from "zod";
import type { ReviewerOutput, ReviewMarker } from "./types";

export const markerSchema = z.object({
  id: z.string().min(1),
  span_text: z.string().min(1),
  category: z.enum(["grammar", "word_choice", "preposition", "tone", "style"]),
  severity: z.enum(["major", "minor", "suggestion"]),
  wrong: z.string().min(1),
  fix: z.string().min(1),
  why: z.string().min(1),
  alternatives: z.array(z.string()).max(3).default([])
});

export const reviewerOutputSchema = z.object({
  markers: z.array(markerSchema),
  native_rewrite: z.string().min(1)
});

export const reviewerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["markers", "native_rewrite"],
  properties: {
    markers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "span_text",
          "category",
          "severity",
          "wrong",
          "fix",
          "why",
          "alternatives"
        ],
        properties: {
          id: { type: "string" },
          span_text: { type: "string" },
          category: {
            type: "string",
            enum: ["grammar", "word_choice", "preposition", "tone", "style"]
          },
          severity: {
            type: "string",
            enum: ["major", "minor", "suggestion"]
          },
          wrong: { type: "string" },
          fix: { type: "string" },
          why: { type: "string" },
          alternatives: {
            type: "array",
            maxItems: 3,
            items: { type: "string" }
          }
        }
      }
    },
    native_rewrite: { type: "string" }
  }
} as const;

const severityRank: Record<ReviewMarker["severity"], number> = {
  major: 3,
  minor: 2,
  suggestion: 1
};

type PositionedMarker = ReviewMarker & {
  start: number;
  end: number;
};

function overlaps(a: PositionedMarker, b: PositionedMarker): boolean {
  return a.start < b.end && b.start < a.end;
}

export function resolveReviewerOutput(
  userMessage: string,
  rawOutput: unknown
): ReviewerOutput {
  const parsed = reviewerOutputSchema.parse(rawOutput);
  const positioned = parsed.markers.flatMap((marker): PositionedMarker[] => {
    const start = userMessage.indexOf(marker.span_text);
    if (start < 0) {
      return [];
    }
    return [
      {
        ...marker,
        start,
        end: start + marker.span_text.length
      }
    ];
  });

  const kept = [...positioned]
    .sort((a, b) => {
      const severity = severityRank[b.severity] - severityRank[a.severity];
      if (severity !== 0) return severity;
      return b.span_text.length - a.span_text.length;
    })
    .reduce<PositionedMarker[]>((accepted, marker) => {
      if (accepted.some((existing) => overlaps(existing, marker))) {
        return accepted;
      }
      return [...accepted, marker];
    }, [])
    .sort((a, b) => a.start - b.start);

  return {
    markers: kept.map((marker) => ({
      id: marker.id,
      span_text: marker.span_text,
      category: marker.category,
      severity: marker.severity,
      wrong: marker.wrong,
      fix: marker.fix,
      why: marker.why,
      alternatives: marker.alternatives
    })),
    native_rewrite: parsed.native_rewrite
  };
}
