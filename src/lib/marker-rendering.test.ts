import { describe, expect, it } from "vitest";
import { buildMarkedSegments } from "./marker-rendering";
import type { ReviewMarker } from "./types";

const marker: ReviewMarker = {
  id: "m1",
  span_text: "want order",
  category: "grammar",
  severity: "major",
  wrong: "want order",
  fix: "would like to order",
  why: "Use the natural request form.",
  alternatives: ["Can I get a coffee?"]
};

describe("marked message segments", () => {
  it("splits message text around resolved marker spans", () => {
    const segments = buildMarkedSegments("I want order coffee", [marker]);

    expect(segments).toEqual([
      { text: "I ", marker: null },
      { text: "want order", marker },
      { text: " coffee", marker: null }
    ]);
  });
});
