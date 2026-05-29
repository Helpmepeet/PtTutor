export function TypingIndicator({ label = "Actor is typing" }: { label?: string }) {
  return (
    <div
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-2xl bg-surface-alt px-4 py-3"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-typing-dot rounded-full bg-text-secondary"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  );
}
