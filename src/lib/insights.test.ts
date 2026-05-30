import { describe, expect, it } from "vitest";
import { aggregateInsights, type InsightRow } from "./insights";
import type { ReviewMarker, ReviewerOutput } from "./types";

function marker(overrides: Partial<ReviewMarker> = {}): ReviewMarker {
  return {
    id: "m1",
    span_text: "I very like",
    category: "grammar",
    severity: "minor",
    wrong: "I very like",
    fix: "I really like",
    why: "Use really before like.",
    alternatives: [],
    ...overrides
  };
}

function output(markers: ReviewMarker[]): ReviewerOutput {
  return {
    markers,
    native_rewrite: "I really like it."
  };
}

function row(
  content: string,
  markers: ReviewMarker[],
  scenarioName = "Coffee shop"
): InsightRow {
  return {
    content,
    reviewer_output: output(markers),
    scenario_name: scenarioName
  };
}

describe("aggregateInsights", () => {
  it("returns all-zero buckets for empty input", () => {
    const summary = aggregateInsights([]);

    expect(summary).toEqual({
      messages_reviewed: 0,
      clean_count: 0,
      total_markers: 0,
      by_category: {
        grammar: 0,
        word_choice: 0,
        preposition: 0,
        tone: 0,
        style: 0
      },
      by_severity: {
        major: 0,
        minor: 0,
        suggestion: 0
      },
      top_fixes: [],
      flashcards: []
    });
  });

  it("counts a single message with one marker", () => {
    const summary = aggregateInsights([
      row("I very like this coffee", [marker()])
    ]);

    expect(summary.messages_reviewed).toBe(1);
    expect(summary.clean_count).toBe(0);
    expect(summary.total_markers).toBe(1);
    expect(summary.by_category.grammar).toBe(1);
    expect(summary.by_severity.minor).toBe(1);
    expect(summary.top_fixes).toEqual([
      {
        wrong: "I very like",
        fix: "I really like",
        category: "grammar",
        severity: "minor",
        count: 1,
        sample_sentence: "I very like this coffee",
        scenario_name: "Coffee shop"
      }
    ]);
    expect(summary.flashcards).toEqual([
      {
        id: "0:m1",
        sentence: "I very like this coffee",
        span_text: "I very like",
        fix: "I really like",
        why: "Use really before like.",
        category: "grammar",
        scenario_name: "Coffee shop"
      }
    ]);
  });

  it("groups repeated fixes by normalized wrong and fix text", () => {
    const summary = aggregateInsights([
      row("I very like coffee", [marker({ id: "a", wrong: "I very like" })]),
      row("I  Very like tea", [marker({ id: "b", wrong: "I  Very like" })])
    ]);

    expect(summary.total_markers).toBe(2);
    expect(summary.by_category.grammar).toBe(2);
    expect(summary.top_fixes).toHaveLength(1);
    expect(summary.top_fixes[0]?.count).toBe(2);
    expect(summary.top_fixes[0]?.wrong).toBe("I very like");
  });

  it("counts reviewed messages with no markers as clean", () => {
    const summary = aggregateInsights([
      row("I very like coffee", [marker()]),
      row("Could I have a coffee?", []),
      row("I go there yesterday", [
        marker({
          id: "m2",
          span_text: "I go there yesterday",
          category: "grammar",
          severity: "major",
          wrong: "I go there yesterday",
          fix: "I went there yesterday",
          why: "Use past tense for yesterday."
        })
      ])
    ]);

    expect(summary.messages_reviewed).toBe(3);
    expect(summary.clean_count).toBe(1);
  });

  it("drops flashcards when the span is not in the sentence", () => {
    const summary = aggregateInsights([
      row("I like coffee", [marker({ span_text: "I very like" })])
    ]);

    expect(summary.total_markers).toBe(1);
    expect(summary.top_fixes).toHaveLength(1);
    expect(summary.flashcards).toEqual([]);
  });

  it("sorts top fixes by count descending", () => {
    const common = marker({ id: "common", wrong: "I very like", fix: "I really like" });
    const rare = marker({
      id: "rare",
      span_text: "I want order",
      category: "word_choice",
      severity: "suggestion",
      wrong: "I want order",
      fix: "I would like to order",
      why: "Use a more natural ordering phrase."
    });

    const summary = aggregateInsights([
      row("I want order coffee", [rare]),
      row("I very like coffee", [common]),
      row("I very like tea", [common])
    ]);

    expect(summary.top_fixes.map((fix) => fix.wrong)).toEqual([
      "I very like",
      "I want order"
    ]);
  });
});
