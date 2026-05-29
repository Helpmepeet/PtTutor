import { Sparkles } from "lucide-react";

type NativeRewriteCardProps = {
  messageId: string;
  rewriteText: string;
  onAskTeacher: (prefill: string) => void;
  onClose: () => void;
};

export function NativeRewriteCard({
  messageId,
  rewriteText,
  onAskTeacher,
  onClose
}: NativeRewriteCardProps) {
  return (
    <div
      className="mt-2 animate-fade-in-up rounded-2xl border border-brand/10 bg-brand-subtle p-4 text-left shadow-sm"
      data-testid={`card-rewrite-${messageId}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
          <Sparkles size={14} /> Native
        </span>
        <button
          className="rounded-md px-1.5 text-text-secondary transition-colors hover:bg-white/60 hover:text-text-primary"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="text-[15px] leading-relaxed text-text-primary">
        {rewriteText}
      </p>
      <div className="mt-3 flex justify-end border-t border-brand/10 pt-3">
        <button
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand transition-colors hover:bg-brand/8"
          onClick={() => onAskTeacher(`Can you explain this native rewrite: "${rewriteText}"`)}
        >
          Ask Teacher →
        </button>
      </div>
    </div>
  );
}
