import type { RoleplayMessage } from "@/lib/types";

type MessageStatusBadgesProps = {
  message: RoleplayMessage;
  onRetry: (messageId: string, target: "actor" | "reviewer" | "both") => void;
  onSkipActor: (messageId: string) => void;
};

export function MessageStatusBadges({
  message,
  onRetry,
  onSkipActor
}: MessageStatusBadgesProps) {
  return (
    <>
      {message.reviewer_status === "failed" ? (
        <button
          className="rounded-full bg-error-bg px-2.5 py-1 text-xs text-error transition-colors hover:bg-red-100"
          onClick={() => onRetry(message.id, "reviewer")}
        >
          Review unavailable
        </button>
      ) : null}
      {message.actor_status === "failed" ? (
        <>
          <button
            className="rounded-full bg-error-bg px-2.5 py-1 text-xs text-error transition-colors hover:bg-red-100"
            onClick={() => onRetry(message.id, "actor")}
          >
            Retry reply
          </button>
          <button
            className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-border-subtle"
            onClick={() => onSkipActor(message.id)}
          >
            Skip
          </button>
        </>
      ) : null}
      {message.reviewer_status === "pending" ? (
        <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-secondary">
          Reviewing...
        </span>
      ) : null}
    </>
  );
}
