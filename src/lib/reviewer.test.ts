import { describe, expect, it } from "vitest";
import { resolveReviewerOutput } from "./reviewer";

describe("reviewer marker resolution", () => {
  it("drops markers whose span_text is not in the latest user message", () => {
    const output = resolveReviewerOutput("I want order coffee", {
      markers: [
        {
          id: "bad",
          span_text: "I would like",
          category: "style",
          severity: "suggestion",
          wrong: "I would like",
          fix: "I'd like",
          why: "Use the exact text.",
          alternatives: []
        }
      ],
      native_rewrite: "I'd like to order coffee."
    });

    expect(output.markers).toEqual([]);
    expect(output.native_rewrite).toBe("I'd like to order coffee.");
  });

  it("keeps the more severe marker when spans overlap", () => {
    const output = resolveReviewerOutput("I want order coffee", {
      markers: [
        {
          id: "minor",
          span_text: "want order",
          category: "grammar",
          severity: "minor",
          wrong: "want order",
          fix: "want to order",
          why: "Use to before the verb.",
          alternatives: []
        },
        {
          id: "major",
          span_text: "I want order",
          category: "grammar",
          severity: "major",
          wrong: "I want order",
          fix: "I'd like to order",
          why: "This is the natural service phrasing.",
          alternatives: []
        }
      ],
      native_rewrite: "I'd like to order coffee."
    });

    expect(output.markers).toHaveLength(1);
    expect(output.markers[0]?.id).toBe("major");
  });
});
