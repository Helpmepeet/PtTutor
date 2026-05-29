type LoginScreenProps = {
  authNotice: string;
  busy: boolean;
  email: string;
  error: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginScreen({
  authNotice,
  busy,
  email,
  error,
  onEmailChange,
  onSubmit
}: LoginScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-8">
      <section className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          English Roleplay Coach
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Enter an allowlisted email to receive a magic link.
        </p>
        <input
          className="mt-6 w-full rounded-[10px] border border-border-subtle px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          type="email"
        />
        <button
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-brand px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover disabled:opacity-40"
          disabled={busy || !email.trim()}
          onClick={onSubmit}
        >
          Send magic link
        </button>
        {authNotice ? (
          <p className="mt-3 text-sm text-text-secondary">{authNotice}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      </section>
    </main>
  );
}
