import { describe, expect, it } from "vitest";
import { extractInlineNarrations } from "./actor-tools";

describe("extractInlineNarrations", () => {
  it("splits a leading *...* stage direction from the dialogue", () => {
    const input =
      "*The espresso machine hisses softly as the barista reaches for a cup.*Sure thing. One hot coffee coming up.";
    const result = extractInlineNarrations(input);
    expect(result.narrations).toEqual([
      "The espresso machine hisses softly as the barista reaches for a cup."
    ]);
    expect(result.content).toBe("Sure thing. One hot coffee coming up.");
  });

  it("pulls out multiple inline narration beats", () => {
    const input = "*She smiles.* Welcome! *The door chimes behind you.* Have a seat.";
    const result = extractInlineNarrations(input);
    expect(result.narrations).toEqual(["She smiles.", "The door chimes behind you."]);
    expect(result.content).toBe("Welcome! Have a seat.");
  });

  it("leaves plain dialogue untouched", () => {
    const input = "Sure, would you like that hot or iced?";
    const result = extractInlineNarrations(input);
    expect(result.narrations).toEqual([]);
    expect(result.content).toBe("Sure, would you like that hot or iced?");
  });

  it("inserts a missing space when sentences run together", () => {
    const input =
      "The barista glances at the case and frowns: the muffin is sold out.Sure thing, I have a croissant.";
    const result = extractInlineNarrations(input);
    expect(result.content).toContain("sold out. Sure thing");
  });

  it("does not treat bold (**...**) as narration", () => {
    const input = "That costs **five dollars**, please.";
    const result = extractInlineNarrations(input);
    expect(result.narrations).toEqual([]);
    // The bold markers collapse but the words stay in the dialogue.
    expect(result.content).toContain("five dollars");
  });
});
