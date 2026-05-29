import { serverEnv } from "../env";
import { getValidTokens } from "./token-store";
import { saveUsageSnapshot } from "./persistence";
import { parseUsageSnapshot } from "./usage";

// Codex request adapter + transport.
//
// Translates this app's "system + user text" request shape into the Codex
// backend Responses-API payload and POSTs it to
// chatgpt.com/backend-api/codex/responses with the subscription OAuth token.
// The backend streams SSE; the roleplay flow only needs the final assembled
// output, so we consume the stream and return the completed text.

export type CodexErrorKind =
  | "auth"
  | "subscription_cap"
  | "rate_limit"
  | "overloaded"
  | "model_rejected"
  | "network"
  | "unknown";

export class CodexError extends Error {
  kind: CodexErrorKind;
  status?: number;

  constructor(kind: CodexErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CodexError";
    this.kind = kind;
    this.status = status;
  }
}

// Status code alone is ambiguous (a 429 can be an ordinary rate limit OR a
// subscription cap; a 401/403 can be transient OR a revoked token), so we
// inspect the response body text to classify.
export function classifyError(status: number, body: string): CodexError {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403) {
    return new CodexError("auth", `Codex auth failed (${status}): ${body.slice(0, 300)}`, status);
  }
  if (status === 429) {
    const isCap =
      lower.includes("usage limit") ||
      lower.includes("quota") ||
      lower.includes("plan") ||
      lower.includes("exceeded") ||
      lower.includes("cap");
    return new CodexError(
      isCap ? "subscription_cap" : "rate_limit",
      `Codex ${isCap ? "subscription cap" : "rate limit"} (429): ${body.slice(0, 300)}`,
      status
    );
  }
  if (status === 404 || status === 400) {
    if (lower.includes("model")) {
      return new CodexError("model_rejected", `Codex rejected model (${status}): ${body.slice(0, 300)}`, status);
    }
  }
  if (status >= 500) {
    return new CodexError("overloaded", `Codex backend error (${status}): ${body.slice(0, 300)}`, status);
  }
  return new CodexError("unknown", `Codex request failed (${status}): ${body.slice(0, 300)}`, status);
}

// Classify a terminal in-stream failure (HTTP 200, then a response.failed /
// error event) from the backend-provided code, preserving the failure kind
// instead of collapsing everything to "unknown".
function classifyStreamCode(code: string | undefined, message: string): CodexError {
  const c = (code ?? "").toLowerCase();
  if (c.includes("auth") || c.includes("token") || c.includes("unauthorized")) {
    return new CodexError("auth", message);
  }
  if (c.includes("usage") || c.includes("quota") || c.includes("cap") || c.includes("plan")) {
    return new CodexError("subscription_cap", message);
  }
  if (c.includes("rate") || c === "rate_limited") {
    return new CodexError("rate_limit", message);
  }
  if (c.includes("overload") || c.includes("server") || c.includes("unavailable")) {
    return new CodexError("overloaded", message);
  }
  if (c.includes("model")) {
    return new CodexError("model_rejected", message);
  }
  return new CodexError("unknown", message);
}

export type CodexTextFormat = {
  type: "json_schema";
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

export type CodexTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

export type ToolCallHandler = (
  name: string,
  args: Record<string, unknown>
) => string;

type CodexInputItem =
  | { role: "user"; content: Array<{ type: "input_text"; text: string }> }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

type CodexRequest = {
  model: string;
  instructions: string;
  input: CodexInputItem[];
  stream: true;
  store: false;
  text?: { format: CodexTextFormat };
  tools?: CodexTool[];
  previous_response_id?: string;
};

function buildRequest({
  model,
  system,
  input,
  textFormat,
  tools
}: {
  model: string;
  system: string;
  input: string;
  textFormat?: CodexTextFormat;
  tools?: CodexTool[];
}): CodexRequest {
  const request: CodexRequest = {
    model,
    instructions: system,
    input: [{ role: "user", content: [{ type: "input_text", text: input }] }],
    stream: true,
    store: false
  };
  if (textFormat) request.text = { format: textFormat };
  if (tools?.length) request.tools = tools;
  return request;
}

// Assemble final output_text from the SSE stream. Prefers the terminal
// response.completed event; falls back to concatenated text deltas.
// Assemble the final output text from decoded SSE chunks. Pure and
// chunk-boundary tolerant (events may split across chunks). Throws CodexError
// on a terminal failure event or when no text is produced. Exported for tests.
export function assembleStreamText(chunks: Iterable<string>): string {
  let buffer = "";
  let deltaText = "";
  let completedText: string | null = null;

  const handleEvent = (raw: string) => {
    const dataLines = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    if (payload === "[DONE]") return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    const type = event.type as string | undefined;
    if (type === "response.output_text.delta" && typeof event.delta === "string") {
      deltaText += event.delta;
    } else if (type === "response.completed" || type === "response.done") {
      const resp = event.response as { output_text?: string } | undefined;
      // Only adopt the terminal text when it is non-empty, so an empty
      // output_text doesn't discard accumulated deltas.
      if (typeof resp?.output_text === "string" && resp.output_text.length > 0) {
        completedText = resp.output_text;
      }
    } else if (type === "response.failed" || type === "error") {
      const errorObj = event.error as { message?: string; code?: string } | undefined;
      const message =
        (event.message as string) || errorObj?.message || "Codex stream failed";
      const code = (event.code as string | undefined) ?? errorObj?.code;
      throw classifyStreamCode(code, message);
    }
  };

  for (const chunk of chunks) {
    buffer += chunk;
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      handleEvent(rawEvent);
    }
  }
  if (buffer.trim()) {
    handleEvent(buffer);
  }

  const text = (completedText ?? deltaText).trim();
  if (!text) {
    throw new CodexError("unknown", "Codex stream produced no text");
  }
  return text;
}

// Parse a single SSE event block and extract a text delta if present.
// Returns the delta string, or null if the event is not a text delta.
// Throws CodexError on failure events.
export function extractDelta(rawEvent: string): string | null {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  if (payload === "[DONE]") return null;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return null;
  }

  const type = event.type as string | undefined;
  if (type === "response.output_text.delta" && typeof event.delta === "string") {
    return event.delta;
  }
  if (type === "response.failed" || type === "error") {
    const errorObj = event.error as { message?: string; code?: string } | undefined;
    const message =
      (event.message as string) || errorObj?.message || "Codex stream failed";
    const code = (event.code as string | undefined) ?? errorObj?.code;
    throw classifyStreamCode(code, message);
  }
  return null;
}

async function consumeStream(response: Response): Promise<string> {
  const body = response.body;
  if (!body) {
    throw new CodexError("network", "Codex returned an empty stream");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return assembleStreamText(chunks);
}

// Shared function to initiate a Codex HTTP request and return the raw Response.
async function fetchCodexResponse(userId: string, request: CodexRequest): Promise<Response> {
  const tokens = await getValidTokens(userId);

  let response: Response;
  try {
    response = await fetch(`${serverEnv.CODEX_BACKEND_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(tokens.account_id ? { "chatgpt-account-id": tokens.account_id } : {}),
        "OpenAI-Beta": "responses=experimental",
        originator: "codex_cli_rs"
      },
      body: JSON.stringify(request)
    });
  } catch (error) {
    throw new CodexError(
      "network",
      error instanceof Error ? error.message : "Codex network error"
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw classifyError(response.status, text);
  }

  // Capture the rate-limit snapshot from response headers and persist it for
  // the usage page. Best-effort: never let usage tracking fail the LLM call.
  const snapshot = parseUsageSnapshot(response.headers);
  if (snapshot) {
    void saveUsageSnapshot(userId, snapshot).catch(() => {});
  }

  return response;
}

async function callCodex(userId: string, request: CodexRequest): Promise<string> {
  const response = await fetchCodexResponse(userId, request);
  return consumeStream(response);
}

// Stream text deltas as they arrive from the Codex SSE stream.
// Yields each text delta string individually.
async function* callCodexStreaming(
  userId: string,
  request: CodexRequest
): AsyncGenerator<string> {
  const response = await fetchCodexResponse(userId, request);
  const body = response.body;
  if (!body) {
    throw new CodexError("network", "Codex returned an empty stream");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const delta = extractDelta(rawEvent);
      if (delta !== null) {
        yield delta;
      }
    }
  }

  // Handle any remaining buffer content
  if (buffer.trim()) {
    const delta = extractDelta(buffer);
    if (delta !== null) {
      yield delta;
    }
  }
}

export function codexText({
  userId,
  model,
  system,
  input
}: {
  userId: string;
  model: string;
  system: string;
  input: string;
}): Promise<string> {
  return callCodex(userId, buildRequest({ model, system, input }));
}

export function codexTextStream({
  userId,
  model,
  system,
  input
}: {
  userId: string;
  model: string;
  system: string;
  input: string;
}): AsyncGenerator<string> {
  return callCodexStreaming(userId, buildRequest({ model, system, input }));
}

export function codexStructured({
  userId,
  model,
  system,
  input,
  textFormat
}: {
  userId: string;
  model: string;
  system: string;
  input: string;
  textFormat: CodexTextFormat;
}): Promise<string> {
  return callCodex(userId, buildRequest({ model, system, input, textFormat }));
}

// Stream text deltas while running a tool-call loop.
// Yields { type: "delta", text } for text tokens and
// { type: "tool_call", name, args } when the model calls a tool.
// The caller provides onToolCall to execute the tool and return the result;
// the loop feeds that result back and continues until the model produces text.
export type StreamWithToolsEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> };

async function* streamWithToolLoop(
  userId: string,
  request: CodexRequest,
  onToolCall: ToolCallHandler,
  maxRounds = 8
): AsyncGenerator<StreamWithToolsEvent> {
  let currentRequest = request;
  let round = 0;

  while (round < maxRounds) {
    round++;
    const response = await fetchCodexResponse(userId, currentRequest);
    const body = response.body;
    if (!body) throw new CodexError("network", "Codex returned an empty stream");

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Collect tool calls and text from this round
    const pendingToolCalls: Array<{ call_id: string; name: string; args_raw: string }> = [];
    let currentCallId: string | null = null;
    let currentCallName: string | null = null;
    let currentCallArgs = "";
    let hadText = false;
    // Track completed function_call items to replay in the continuation request.
    // The Responses API requires the function_call item to appear in the input
    // alongside its function_call_output so the backend can match call_ids.
    const completedFunctionCalls: Array<{ call_id: string; name: string; arguments: string }> = [];

    const handleEvent = (raw: string): string | null => {
      const dataLines = raw
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trim());
      if (!dataLines.length) return null;
      const payload = dataLines.join("\n");
      if (payload === "[DONE]") return null;

      let event: Record<string, unknown>;
      try { event = JSON.parse(payload); } catch { return null; }

      const type = event.type as string | undefined;

      if (type === "response.output_text.delta" && typeof event.delta === "string") {
        hadText = true;
        return event.delta;
      }

      // Tool call started
      if (type === "response.output_item.added") {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          currentCallId = item.call_id as string;
          currentCallName = item.name as string;
          currentCallArgs = "";
        }
        return null;
      }

      // Tool call arguments streaming
      if (type === "response.function_call_arguments.delta" && typeof event.delta === "string") {
        currentCallArgs += event.delta;
        return null;
      }

      // Tool call done
      if (type === "response.function_call_arguments.done") {
        if (currentCallId && currentCallName) {
          pendingToolCalls.push({
            call_id: currentCallId,
            name: currentCallName,
            args_raw: currentCallArgs
          });
        }
        currentCallId = null;
        currentCallName = null;
        currentCallArgs = "";
        return null;
      }

      if (type === "response.failed" || type === "error") {
        const errorObj = event.error as { message?: string; code?: string } | undefined;
        const message = (event.message as string) || errorObj?.message || "Codex stream failed";
        const code = (event.code as string | undefined) ?? errorObj?.code;
        throw classifyStreamCode(code, message);
      }

      return null;
    };

    // Stream this round
    const deltas: string[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const delta = handleEvent(rawEvent);
        if (delta !== null) {
          deltas.push(delta);
          yield { type: "delta", text: delta };
        }
      }
    }
    if (buffer.trim()) {
      const delta = handleEvent(buffer);
      if (delta !== null) {
        deltas.push(delta);
        yield { type: "delta", text: delta };
      }
    }

    // If no tool calls, we're done
    if (!pendingToolCalls.length) {
      if (!hadText && !deltas.length) {
        throw new CodexError("unknown", "Codex stream produced no text");
      }
      return;
    }

    // Execute tool calls and build next request inputs
    const toolOutputItems: CodexInputItem[] = [];
    for (const call of pendingToolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.args_raw); } catch { /* use empty */ }
      yield { type: "tool_call", name: call.name, args };
      const result = onToolCall(call.name, args);
      toolOutputItems.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: result
      });
    }

    // Build continuation request
    currentRequest = {
      ...request,
      input: [...request.input, ...toolOutputItems]
    };
  }
}

export function codexTextStreamWithTools({
  userId,
  model,
  system,
  input,
  tools,
  onToolCall
}: {
  userId: string;
  model: string;
  system: string;
  input: string;
  tools: CodexTool[];
  onToolCall: ToolCallHandler;
}): AsyncGenerator<StreamWithToolsEvent> {
  return streamWithToolLoop(
    userId,
    buildRequest({ model, system, input, tools }),
    onToolCall
  );
}

