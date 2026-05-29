import { Send } from "lucide-react";
import { useEffect, useRef } from "react";

type InputBarProps = {
  disabled: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export function InputBar({
  disabled,
  draft,
  onDraftChange,
  onSend
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [draft]);

  return (
    <div
      className="flex h-[72px] shrink-0 items-center border-t border-border-subtle bg-surface px-6"
      data-testid="message-composer-row"
    >
      <div
        className="flex h-12 w-full items-center gap-2 rounded-[14px] border border-border-subtle bg-surface px-3 transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/20"
        data-testid="message-composer"
      >
        <textarea
          ref={textareaRef}
          className="max-h-8 min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-5 outline-none placeholder:text-text-muted disabled:opacity-50"
          data-testid="input-message"
          placeholder="Type your message..."
          disabled={disabled}
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
          aria-label="Send message"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand text-text-inverse transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="btn-send"
          disabled={disabled || !draft.trim()}
          onClick={onSend}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
