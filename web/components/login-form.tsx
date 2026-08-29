'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/**
 * Sign in.
 *
 * Google appears only when real credentials are configured. When they are not,
 * this offers a demo session and says exactly what that means — no imitation of
 * anyone else's sign in flow.
 */
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  /** Where the visitor was actually heading before the gate stopped them. */
  const target = useSearchParams().get('callbackUrl') ?? '/dashboard';

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-2">
      <div className="rounded-lg border border-line bg-ink p-4">
        {googleEnabled ? (
          <>
            <button
              type="button"
              onClick={() => void signIn('google', { redirectTo: target })}
              className="ease-fluid w-full rounded-full bg-fg px-3 py-2 text-base font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]"
            >
              Continue with Google
            </button>
            <p className="mt-4 text-xs text-pretty text-fg-3">
              Real Google OAuth. There is no email fallback while this is configured — a second door
              that accepts any address would make the first one decorative.
            </p>
          </>
        ) : null}

        {/* Rendered only without OAuth, so what is on screen matches what the server accepts. */}
        {googleEnabled ? null : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void signIn('demo', { email, redirectTo: target });
          }}
        >
          <label className="block">
            <span className="font-mono text-xs tracking-wider text-fg-3">WORK EMAIL</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="you@company.com"
              className="ease-fluid mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-base text-fg transition-colors duration-500 outline-none placeholder:text-fg-3 focus-visible:border-safe"
            />
          </label>
          <button
            type="submit" disabled={busy}
            className="ease-fluid mt-4 w-full rounded-full bg-fg px-3 py-2 text-base font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98] disabled:opacity-30"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        )}

        {googleEnabled ? null : (
          <p className="mt-4 text-xs text-pretty text-fg-3">
            <b className="font-medium text-fg-2">This is a demo session.</b> It accepts any valid
            email address and verifies nothing. Real Google sign in is wired and switches on when
            OAuth credentials are configured — we would rather show you this than a button that
            looks like Google and is not.
          </p>
        )}
      </div>
    </div>
  );
}
