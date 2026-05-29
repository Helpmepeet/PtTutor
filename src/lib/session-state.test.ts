import { describe, expect, it } from "vitest";
import { actorFailureBlocksInput } from "./session-state";
import type { RoleplayMessage } from "./types";

function userMessage(actor_status: RoleplayMessage["actor_status"]): RoleplayMessage {
  return {
    id: crypto.randomUUID(),
    session_id: "session-1",
    role: "user",
    content: "I want order coffee",
    created_at: new Date().toISOString(),
    actor_status
  };
}

describe("session state", () => {
  it("blocks roleplay input when the latest user message has a failed Actor reply", () => {
    expect(actorFailureBlocksInput([userMessage("failed")])).toBe(true);
  });

  it("unblocks input after Actor retry succeeds or the user skips the failed reply", () => {
    expect(actorFailureBlocksInput([userMessage("succeeded")])).toBe(false);
    expect(actorFailureBlocksInput([userMessage("skipped")])).toBe(false);
  });
});
