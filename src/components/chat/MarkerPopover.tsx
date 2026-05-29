import { useEffect, useRef } from "react";
import type { ReviewMarker } from "@/lib/types";

const markerColors: Record<ReviewMarker["category"], string> = {
  grammar: "#FF6B6B",
  word_choice: "#FFD93D",
  preposition: "#FF9A3C",
  tone: "#74C0FC",
  style: "#B8C0CC"
};

type MarkerPopoverProps = {
  index: number;
  marker: ReviewMarker;
  markers: ReviewMarker[];
  onAskTeacher: (prefill: string) => void;
  onClose: () => void;
  onMove: (index: number) => void;
};

export function MarkerPopover({
  index,
  marker,
  markers,
  onAskTeacher,
  onClose,
  onMove
}: MarkerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const color = markerColors[marker.category];

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onMove(index - 1);
      if (event.key === "ArrowRight" && index < markers.length - 1) {
        onMove(index + 1);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [index, markers.length, onClose, onMove]);

  return (
    <div
      ref={ref}
      aria-label={`Feedback for: ${marker.span_text}`}
      className="absolute right-0 top-[calc(100%+10px)] z-30 w-80 animate-scale-in overflow-hidden rounded-[14px] border border-border-subtle bg-surface-elevated text-left text-sm text-text-primary shadow-popover"
      data-testid="popover-marker"
      role="dialog"
    >
      <div className="pointer-events-none absolute right-8 top-[-5px] size-3 rotate-45 border-l border-t border-border-subtle bg-surface-elevated" />

      {/* Category accent strip */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="flex items-center justify-between px-4 pb-2.5 pt-3">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
          {marker.category.replace("_", " ")}
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{marker.severity}</span>
        </span>
        <span className="flex items-center gap-2">
          {markers.length > 1 ? (
            <span className="text-xs font-medium text-text-muted">
              {index + 1}/{markers.length}
            </span>
          ) : null}
          <button
            aria-label="Close"
            className="flex size-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
            onClick={onClose}
          >
            ×
          </button>
        </span>
      </div>

      {/* Diff: the wrong phrase, an arrow, then the fix */}
      <div className="mx-4 flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed">
        <span className="text-text-muted line-through decoration-error/60">
          {marker.wrong}
        </span>
        <span className="shrink-0 text-text-muted" aria-hidden>
          →
        </span>
        <span className="font-semibold text-success">{marker.fix}</span>
      </div>

      <div className="mt-3 px-4">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          Why
        </div>
        <p className="text-sm leading-6 text-text-primary">{marker.why}</p>
      </div>

      {marker.alternatives.length > 0 ? (
        <div className="mt-3 px-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Other ways to say it
          </div>
          <ul className="space-y-1.5 text-sm leading-6">
            {marker.alternatives.map((alternative) => (
              <li
                key={alternative}
                className="rounded-md bg-surface-alt px-2.5 py-1.5 text-text-primary"
              >
                {alternative}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={`mx-4 mt-3 flex items-center border-t border-border-subtle py-2.5 ${markers.length > 1 ? "justify-between" : "justify-end"}`}>
        {markers.length > 1 ? (
          <div className="flex items-center gap-1 text-text-secondary">
            <button
              aria-label="Previous issue"
              className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-30"
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              ←
            </button>
            <span className="min-w-10 text-center text-xs text-text-muted">
              {index + 1} / {markers.length}
            </span>
            <button
              aria-label="Next issue"
              className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-30"
              disabled={index === markers.length - 1}
              onClick={() => onMove(index + 1)}
            >
              →
            </button>
          </div>
        ) : null}
        <button
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand transition-colors hover:bg-brand-subtle"
          onClick={() => {
            onAskTeacher(`Why is "${marker.wrong}" wrong? And how is "${marker.fix}" better?`);
            onClose();
          }}
        >
          Ask Teacher →
        </button>
      </div>
    </div>
  );
}

export { markerColors };
