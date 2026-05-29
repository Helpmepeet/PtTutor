import type { RoleplayMessage } from "./types";

export function actorFailureBlocksInput(messages: RoleplayMessage[]): boolean {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return latestUserMessage?.actor_status === "failed";
}
