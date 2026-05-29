import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { actorFailureBlocksInput } from "@/lib/session-state";
import type { ReviewMarker, RoleplayMessage, Scenario, SessionDetail } from "@/lib/types";
import { InputBar } from "./InputBar";
import { MarkerPopover } from "./MarkerPopover";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

function NarrationRow({ text }: { text: string }) {
  return (
    <div className="flex justify-center px-6 py-0.5" role="note">
      <p className="text-center text-[13px] italic leading-relaxed text-text-muted">
        <span className="sr-only">Scene: </span>
        {text}
      </p>
    </div>
  );
}

type ChatAreaProps = {
  busy: boolean;
  draft: string;
  scenario?: Scenario;
  session: SessionDetail;
  streamingActorContent: string | null;
  streamingNarrations: string[];
  onAskTeacher: (prefill: string) => void;
  onDraftChange: (value: string) => void;
  onRetry: (messageId: string, target: "actor" | "reviewer" | "both") => void;
  onSend: () => void;
  onSendStarter: (text: string) => void;
  onSkipActor: (messageId: string) => void;
};

function actorLabelFromScenario(scenario?: Scenario): string {
  const role = scenario?.actor_role
    .replace(/^(an?|the)\s+/i, "")
    .replace(/\s+(at|in|on|who|with)\s+.*$/i, "")
    .trim();
  if (!role) return "Actor";
  return role
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ChatArea({
  busy,
  draft,
  scenario,
  session,
  streamingActorContent,
  streamingNarrations,
  onAskTeacher,
  onDraftChange,
  onRetry,
  onSend,
  onSendStarter,
  onSkipActor
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMarker, setActiveMarker] = useState<{
    messageId: string;
    index: number;
  } | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState<Record<string, boolean>>({});

  // Auto-scroll when messages change or streaming content updates
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const distanceFromBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;
    if (distanceFromBottom < 180) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [session.messages.length, session.teacher_messages.length, streamingActorContent]);

  function markerFor(message: RoleplayMessage): ReviewMarker | null {
    if (!activeMarker || activeMarker.messageId !== message.id) return null;
    return message.reviewer_output?.markers[activeMarker.index] ?? null;
  }

  const inputBlockedByActorFailure = actorFailureBlocksInput(session.messages);
  const inputDisabled = busy || inputBlockedByActorFailure;
  const actorLabel = actorLabelFromScenario(scenario);

  // Determine if we should show the typing indicator:
  // Show it when busy and actor is expected (last message is from user with pending actor status)
  // but NOT when streaming content has started arriving
  const lastMessage = session.messages[session.messages.length - 1];
  const showTypingIndicator =
    busy &&
    lastMessage?.role === "user" &&
    lastMessage?.actor_status === "pending" &&
    streamingActorContent === null;

  return (
    <>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        role="log"
        aria-live="polite"
        data-teacher-launcher-bounds
      >
        {session.messages.length === 0 ? (
          <div className="mx-auto mt-24 max-w-md text-center">
            <p className="text-sm leading-6 text-text-secondary">
              {scenario?.starter === "user"
                ? "Say something to begin."
                : `${actorLabel} is getting ready...`}
            </p>
            {scenario?.starter === "user" && scenario.starter_prompts && scenario.starter_prompts.length > 0 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {scenario.starter_prompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-text-secondary shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                    onClick={() => onSendStarter(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {session.messages.map((message) => {
              const marker = markerFor(message);
              return (
                <div key={message.id}>
                  {message.role === "actor" && (message.narrations ?? []).map((text, i) => (
                    <NarrationRow key={i} text={text} />
                  ))}
                <div
                  className={clsx(
                    "relative flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <MessageBubble
                    activeMarker={marker}
                    actorLabel={actorLabel}
                    message={message}
                    rewriteOpen={Boolean(rewriteOpen[message.id])}
                    onAskTeacher={onAskTeacher}
                    onMarkerClick={(index) =>
                      setActiveMarker({ messageId: message.id, index })
                    }
                    onRetry={onRetry}
                    onRewriteToggle={() =>
                      setRewriteOpen((current) => ({
                        ...current,
                        [message.id]: !current[message.id]
                      }))
                    }
                    onSkipActor={onSkipActor}
                  />
                  {marker ? (
                    <MarkerPopover
                      index={activeMarker?.index ?? 0}
                      marker={marker}
                      markers={message.reviewer_output?.markers ?? []}
                      onAskTeacher={onAskTeacher}
                      onClose={() => setActiveMarker(null)}
                      onMove={(index) =>
                        setActiveMarker({ messageId: message.id, index })
                      }
                    />
                  ) : null}
                </div>
                </div>
              );
            })}

            {/* Streaming narrations (arrive before actor text) */}
            {streamingNarrations.map((text, i) => (
              <NarrationRow key={i} text={text} />
            ))}

            {/* Streaming actor message */}
            {streamingActorContent !== null ? (
              <div className="relative flex justify-start">
                <div className="max-w-[min(600px,70%)] animate-fade-in-up">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                    {actorLabel}
                  </div>
                  <div className="rounded-2xl bg-surface-alt px-4 py-3 text-[15px] leading-relaxed text-text-primary">
                    {streamingActorContent}
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-text-secondary align-text-bottom" />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Typing indicator before first delta arrives */}
            {showTypingIndicator ? (
              <div className="flex justify-start">
                <TypingIndicator label={`${actorLabel} is typing`} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <InputBar
        disabled={inputDisabled}
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
      />
    </>
  );
}
