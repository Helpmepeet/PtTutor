import { MessageCircleQuestion, Minus, Send, X } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TeacherMessage } from "@/lib/types";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

type TeacherWidgetProps = {
  busy: boolean;
  draft: string;
  messages: TeacherMessage[];
  open: boolean;
  streamingContent: string | null;
  onDraftChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
};

type LauncherPosition = {
  x: number;
  y: number;
};

type LauncherDrag = {
  moved: boolean;
  origin: LauncherPosition;
  pointer: LauncherPosition;
};

const launcherSize = 48;
const launcherMargin = 16;
const launcherDefaultBottom = 96;
const launcherSnapDurationMs = 180;
const launcherStorageKey = "pttutor.teacherLauncherPosition";
const launcherBoundsSelector = "[data-teacher-launcher-bounds]";

function getLauncherBounds() {
  if (typeof window === "undefined") {
    return {
      bottom: launcherMargin + launcherSize,
      left: 0,
      right: launcherMargin + launcherSize,
      top: 0
    };
  }

  const boundary = document.querySelector(launcherBoundsSelector);
  const rect = boundary?.getBoundingClientRect();
  if (rect && rect.width > launcherSize && rect.height > launcherSize) {
    return rect;
  }

  return {
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0
  };
}

function clampLauncherPosition(position: LauncherPosition): LauncherPosition {
  if (typeof window === "undefined") return position;
  const bounds = getLauncherBounds();

  return {
    x: Math.min(
      Math.max(position.x, bounds.left + launcherMargin),
      bounds.right - launcherSize - launcherMargin
    ),
    y: Math.min(
      Math.max(position.y, bounds.top + launcherMargin),
      bounds.bottom - launcherSize - launcherMargin
    )
  };
}

function snapLauncherToSide(position: LauncherPosition): LauncherPosition {
  if (typeof window === "undefined") return position;

  const clamped = clampLauncherPosition(position);
  const bounds = getLauncherBounds();
  const rightX = bounds.right - launcherSize - launcherMargin;
  const centerX = clamped.x + launcherSize / 2;

  return {
    x: centerX < (bounds.left + bounds.right) / 2
      ? bounds.left + launcherMargin
      : rightX,
    y: clamped.y
  };
}

function defaultLauncherPosition(): LauncherPosition {
  if (typeof window === "undefined") {
    return { x: launcherMargin, y: launcherMargin };
  }

  return snapLauncherToSide({
    x: getLauncherBounds().right - launcherSize - launcherMargin,
    y: getLauncherBounds().bottom - launcherSize - launcherDefaultBottom
  });
}

function readStoredLauncherPosition(): LauncherPosition | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(launcherStorageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LauncherPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return null;
    }
    return snapLauncherToSide({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
}

function storeLauncherPosition(position: LauncherPosition) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(launcherStorageKey, JSON.stringify(position));
}

export function TeacherWidget({
  busy,
  draft,
  messages,
  open,
  streamingContent,
  onDraftChange,
  onOpenChange,
  onSend
}: TeacherWidgetProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<LauncherDrag | null>(null);
  const positionRef = useRef<LauncherPosition | null>(null);
  const suppressClickRef = useRef(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition>(
    () => readStoredLauncherPosition() ?? defaultLauncherPosition()
  );

  useEffect(() => {
    positionRef.current = launcherPosition;
  }, [launcherPosition]);

  useLayoutEffect(() => {
    setLauncherPosition((current) => {
      const next = snapLauncherToSide(current);
      positionRef.current = next;
      storeLauncherPosition(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function persistPosition(position: LauncherPosition) {
      positionRef.current = position;
      storeLauncherPosition(position);
    }

    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = event.clientX - drag.pointer.x;
      const dy = event.clientY - drag.pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        drag.moved = true;
      }
      setIsSnapping(false);

      const next = clampLauncherPosition({
        x: drag.origin.x + dx,
        y: drag.origin.y + dy
      });
      positionRef.current = next;
      setLauncherPosition(next);
    }

    function handlePointerUp() {
      const drag = dragRef.current;
      if (!drag) return;

      suppressClickRef.current = drag.moved;
      dragRef.current = null;

      const next = snapLauncherToSide(positionRef.current ?? drag.origin);
      persistPosition(next);
      if (drag.moved) {
        setIsSnapping(true);
        if (snapTimerRef.current) {
          clearTimeout(snapTimerRef.current);
        }
        snapTimerRef.current = setTimeout(() => {
          setIsSnapping(false);
          snapTimerRef.current = null;
        }, launcherSnapDurationMs);
      }
      setLauncherPosition(next);
    }

    function handleResize() {
      setLauncherPosition((current) => {
        const next = snapLauncherToSide(current);
        persistPosition(next);
        return next;
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("resize", handleResize);
    return () => {
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;

      onOpenChange(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!bodyRef.current?.scrollTo) return;

    bodyRef.current.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, busy, streamingContent]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 72)}px`;
  }, [draft]);

  if (!open) {
    return (
      <button
        aria-label="Open Teacher chat"
        className={clsx(
          "fixed z-40 flex size-12 touch-none items-center justify-center rounded-full border border-border-subtle bg-surface text-text-primary shadow-popover transition-colors duration-200 hover:bg-surface-alt active:cursor-grabbing",
          "cursor-grab",
          isSnapping && "transition-[left,top] duration-200 ease-out"
        )}
        data-testid="btn-teacher"
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            suppressClickRef.current = false;
            return;
          }
          onOpenChange(true);
        }}
        onPointerDown={(event) => {
          dragRef.current = {
            moved: false,
            origin: launcherPosition,
            pointer: {
              x: event.clientX,
              y: event.clientY
            }
          };
        }}
        style={{
          left: `${launcherPosition.x}px`,
          top: `${launcherPosition.y}px`
        }}
        title="Teacher"
      >
        <MessageCircleQuestion size={21} />
      </button>
    );
  }

  return (
    <section
      aria-label="Teacher chat"
      className="fixed bottom-4 right-4 z-40 flex h-[min(560px,calc(100vh-32px))] w-[min(380px,calc(100vw-280px))] min-w-[320px] origin-bottom-right animate-scale-in flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated shadow-teacher lg:bottom-6 lg:right-6"
      ref={panelRef}
      role="complementary"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-alt/50 px-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <MessageCircleQuestion size={18} /> Teacher
        </div>
        <div className="flex items-center gap-1">
          <button
            className="size-7 rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
            onClick={() => onOpenChange(false)}
          >
            <Minus size={15} />
          </button>
          <button
            className="size-7 rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
            onClick={() => onOpenChange(false)}
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mt-16 text-center text-sm leading-6 text-text-secondary">
            Ask me anything about the conversation.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={clsx(
                  "max-w-[280px] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                  message.role === "user"
                    ? "rounded-tr-md bg-brand text-text-inverse"
                    : "rounded-tl-md bg-surface-alt text-text-primary"
                )}
              >
                {message.role === "teacher" ? (
                  <div className="prose-teacher">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))
        )}
        {/* Streaming teacher message */}
        {streamingContent !== null ? (
          <div className="flex justify-start">
            <div className="max-w-[280px] rounded-2xl rounded-tl-md bg-surface-alt px-3.5 py-2.5 text-sm leading-6 text-text-primary">
              <div className="prose-teacher">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent}
                </ReactMarkdown>
              </div>
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-text-secondary align-text-bottom" />
            </div>
          </div>
        ) : null}
        {/* Typing indicator before first delta */}
        {busy && streamingContent === null ? (
          <div className="flex justify-start">
            <TypingIndicator label="Teacher is typing" />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2">
        <textarea
          ref={textareaRef}
          className="max-h-[72px] min-h-9 flex-1 resize-none rounded-[10px] border border-border-subtle px-3 py-2 text-sm outline-none transition-colors placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand/20"
          data-testid="input-teacher"
          placeholder="Ask Teacher..."
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button
          aria-label="Send Teacher question"
          className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand text-text-inverse transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="btn-teacher-send"
          disabled={!draft.trim()}
          onClick={onSend}
        >
          <Send size={16} />
        </button>
      </div>
    </section>
  );
}
