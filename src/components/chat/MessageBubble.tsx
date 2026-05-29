import { Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { buildMarkedSegments } from "@/lib/marker-rendering";
import type { ReviewMarker, RoleplayMessage } from "@/lib/types";
import { markerColors } from "./MarkerPopover";
import { MessageStatusBadges } from "./MessageStatusBadges";
import { NativeRewriteCard } from "./NativeRewriteCard";

type MessageBubbleProps = {
  activeMarker: ReviewMarker | null;
  actorLabel: string;
  message: RoleplayMessage;
  rewriteOpen: boolean;
  onAskTeacher: (prefill: string) => void;
  onMarkerClick: (index: number) => void;
  onRetry: (messageId: string, target: "actor" | "reviewer" | "both") => void;
  onRewriteToggle: () => void;
  onSkipActor: (messageId: string) => void;
};

function normalizeRewriteText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hasUsefulNativeRewrite(
  originalText: string,
  nativeRewrite: string | undefined
) {
  if (!nativeRewrite) return false;
  return normalizeRewriteText(originalText) !== normalizeRewriteText(nativeRewrite);
}

export function MessageBubble({
  activeMarker,
  actorLabel,
  message,
  rewriteOpen,
  onAskTeacher,
  onMarkerClick,
  onRetry,
  onRewriteToggle,
  onSkipActor
}: MessageBubbleProps) {
  const user = message.role === "user";
  const speakerLabel = user ? "You" : actorLabel;
  const markers = message.reviewer_output?.markers ?? [];
  const segments = user ? buildMarkedSegments(message.content, markers) : [];
  const usefulRewrite = hasUsefulNativeRewrite(
    message.content,
    message.reviewer_output?.native_rewrite
  );
  const hasStatusBadges =
    message.reviewer_status === "failed" ||
    message.actor_status === "failed" ||
    message.reviewer_status === "pending";
  const showActionRow = user && (hasStatusBadges || (message.reviewer_output && usefulRewrite));
  return (
    <div className="max-w-[min(600px,70%)] animate-fade-in-up inline-block">
      <div
        className={clsx(
          "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted",
          user && "text-right"
        )}
      >
        {speakerLabel}
      </div>
      <div
        aria-label={`${speakerLabel} said: ${message.content}`}
        className={clsx(
          "rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
          user
            ? "bg-brand text-text-inverse"
            : "bg-surface-alt text-text-primary"
        )}
        data-testid={`msg-${message.id}`}
      >
        {user
          ? segments.map((segment, index) => {
              if (!segment.marker) {
                return (
                  <span key={`${segment.text}-${index}`}>{segment.text}</span>
                );
              }

              const markerIndex = markers.findIndex(
                (marker) => marker.id === segment.marker?.id
              );
              const color = markerColors[segment.marker.category];

              const severity = segment.marker.severity;
              const isActive = activeMarker?.id === segment.marker.id;

              // Severity drives underline weight/style (per spec §4.3):
              // major = 2px solid, minor = 1.5px solid, suggestion = dotted.
              const underlineWidth = severity === "major" ? "2px" : "1.5px";
              const underlineStyle = severity === "suggestion" ? "dotted" : "solid";

              return (
                <button
                  key={segment.marker.id}
                  aria-haspopup="dialog"
                  aria-label={`${segment.marker.category.replace("_", " ")} ${severity} issue: ${segment.text}`}
                  className={clsx(
                    "cursor-pointer rounded-sm text-left underline-offset-[5px] transition-colors",
                    isActive ? "bg-white/20" : "hover:bg-white/10"
                  )}
                  data-testid={`marker-${segment.marker.id}`}
                  onClick={() => onMarkerClick(markerIndex)}
                  style={{
                    textDecorationLine: "underline",
                    textDecorationColor: color,
                    textDecorationStyle: underlineStyle,
                    textDecorationThickness: underlineWidth
                  }}
                >
                  {segment.text}
                </button>
              );
            })
          : message.content}
      </div>

      {showActionRow ? (
        <>
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <MessageStatusBadges
              message={message}
              onRetry={onRetry}
              onSkipActor={onSkipActor}
            />
            {message.reviewer_output ? usefulRewrite ? (
              <button
                className="inline-flex size-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                data-testid={`btn-rewrite-${message.id}`}
                onClick={onRewriteToggle}
                title="Show native version"
              >
                <Sparkles size={15} />
              </button>
            ) : null : null}
          </div>
          {rewriteOpen && message.reviewer_output && usefulRewrite ? (
            <NativeRewriteCard
              messageId={message.id}
              rewriteText={message.reviewer_output.native_rewrite}
              onAskTeacher={onAskTeacher}
              onClose={onRewriteToggle}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
