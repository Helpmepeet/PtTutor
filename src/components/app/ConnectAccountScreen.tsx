type ConnectAccountScreenProps = {
  error: string;
  onSignOut: () => void;
};

// Shown after sign-in when the user has not yet linked their OpenAI account.
// Roleplay is gated behind this step because every LLM call bills to the
// user's own ChatGPT/Codex subscription.
export function ConnectAccountScreen({ error, onSignOut }: ConnectAccountScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-8">
      <section className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          Connect your OpenAI account
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Roleplay runs on your own ChatGPT subscription. Sign in with OpenAI
          once to start practicing — your conversations bill to your account.
        </p>

        <a
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-brand px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover"
          href="/api/codex/login"
        >
          Connect with OpenAI
        </a>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

        <button
          className="mt-4 text-sm text-text-secondary underline-offset-2 hover:underline"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}
