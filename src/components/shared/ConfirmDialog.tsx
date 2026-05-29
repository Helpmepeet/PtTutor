type ConfirmDialogProps = {
  body: string;
  confirmLabel: string;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  body,
  confirmLabel,
  open,
  title,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="w-full max-w-sm animate-scale-in rounded-2xl bg-surface p-6 shadow-teacher">
        <h2
          id="confirm-title"
          className="text-xl font-semibold leading-snug tracking-[-0.01em]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-[10px] px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-alt"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-[10px] bg-error px-4 py-2 text-sm font-medium text-text-inverse transition-opacity hover:opacity-90"
            data-testid="btn-confirm-delete"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
