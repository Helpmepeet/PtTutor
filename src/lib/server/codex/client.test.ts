import { describe, expect, it } from "vitest";
import {
  assembleStreamText,
  buildContinuationInput,
  classifyError,
  CodexError,
  type CodexInputItem
} from "./client";

function sse(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe("assembleStreamText", () => {
  it("concatenates output_text deltas", () => {
    const chunks = [
      sse({ type: "response.output_text.delta", delta: "Hello" }),
      sse({ type: "response.output_text.delta", delta: ", world" })
    ];
    expect(assembleStreamText(chunks)).toBe("Hello, world");
  });

  it("prefers the terminal completed output_text over deltas", () => {
    const chunks = [
      sse({ type: "response.output_text.delta", delta: "partial" }),
      sse({ type: "response.completed", response: { output_text: "Final answer" } })
    ];
    expect(assembleStreamText(chunks)).toBe("Final answer");
  });

  it("falls back to deltas when completed output_text is empty", () => {
    const chunks = [
      sse({ type: "response.output_text.delta", delta: "kept text" }),
      sse({ type: "response.completed", response: { output_text: "" } })
    ];
    expect(assembleStreamText(chunks)).toBe("kept text");
  });

  it("tolerates events split across chunk boundaries", () => {
    const full = sse({ type: "response.output_text.delta", delta: "spanned" });
    const mid = Math.floor(full.length / 2);
    expect(assembleStreamText([full.slice(0, mid), full.slice(mid)])).toBe("spanned");
  });

  it("ignores [DONE] and unparseable payloads", () => {
    const chunks = [
      "data: [DONE]\n\n",
      "data: not json\n\n",
      sse({ type: "response.output_text.delta", delta: "ok" })
    ];
    expect(assembleStreamText(chunks)).toBe("ok");
  });

  it("classifies a terminal rate_limited failure event", () => {
    const chunks = [sse({ type: "response.failed", code: "rate_limited", message: "slow down" })];
    try {
      assembleStreamText(chunks);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CodexError);
      expect((error as CodexError).kind).toBe("rate_limit");
    }
  });

  it("throws when the stream produces no text", () => {
    expect(() => assembleStreamText([sse({ type: "response.started" })])).toThrow(CodexError);
  });
});

describe("classifyError", () => {
  it("maps 401/403 to auth", () => {
    expect(classifyError(401, "nope").kind).toBe("auth");
    expect(classifyError(403, "forbidden").kind).toBe("auth");
  });

  it("distinguishes a 429 subscription cap from an ordinary rate limit", () => {
    expect(classifyError(429, "You have exceeded your plan usage limit").kind).toBe(
      "subscription_cap"
    );
    expect(classifyError(429, "Too many requests, slow down").kind).toBe("rate_limit");
  });

  it("maps model rejection and 5xx", () => {
    expect(classifyError(404, "unknown model gpt-5.4-mini").kind).toBe("model_rejected");
    expect(classifyError(503, "service unavailable").kind).toBe("overloaded");
  });
});

describe("buildContinuationInput", () => {
  const original: CodexInputItem[] = [
    { role: "user", content: [{ type: "input_text", text: "hi" }] }
  ];

  it("replays the function_call item alongside its output (the call_id must match)", () => {
    const result = buildContinuationInput(original, [
      { call_id: "call_abc", name: "narrate", arguments: '{"text":"x"}', output: "x" }
    ]);

    const fnCall = result.find(
      (item): item is Extract<CodexInputItem, { type: "function_call" }> =>
        "type" in item && item.type === "function_call"
    );
    const fnOutput = result.find(
      (item): item is Extract<CodexInputItem, { type: "function_call_output" }> =>
        "type" in item && item.type === "function_call_output"
    );

    // The bug was sending the output without the function_call item, causing
    // "No tool call found for function call output with call_id ...".
    expect(fnCall).toBeDefined();
    expect(fnCall?.call_id).toBe("call_abc");
    expect(fnOutput?.call_id).toBe("call_abc");
  });

  it("keeps original input first, then calls, then outputs", () => {
    const result = buildContinuationInput(original, [
      { call_id: "c1", name: "narrate", arguments: "{}", output: "o1" }
    ]);
    expect(result[0]).toBe(original[0]);
    expect((result[1] as { type: string }).type).toBe("function_call");
    expect((result[2] as { type: string }).type).toBe("function_call_output");
  });
});
