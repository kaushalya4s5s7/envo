'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/** Google's own four color mark — standard practice for a sign in button, not a fabricated logo. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="flex-none">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.68 9c0-.593.102-1.17.284-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * Sign in.
 *
 * Google is offered whenever it's configured, and email is always offered
 * alongside it — not everyone signing in has a Google account. See auth.ts
 * for why the email path is honest about verifying nothing, rather than
 * pretending it does.
 */
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  /** Where the visitor was actually heading before the gate stopped them. */
  const target = useSearchParams().get('callbackUrl') ?? '/dashboard';

  return (
    <div>
      {googleEnabled ? (
        <>
          <button
            type="button"
            onClick={() => void signIn('google', { redirectTo: target })}
            className="ease-fluid flex w-full items-center justify-center gap-3 rounded-lg border border-line-2 bg-surface-2 px-3 py-3 text-base font-semibold text-fg transition-all duration-500 hover:bg-surface-3 active:scale-[0.99]"
          >
            <GoogleIcon />
            Sign in with Google
          </button>
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-fg-3">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void signIn('demo', { email, redirectTo: target });
        }}
      >
        <label className="block">
          <span className="text-sm font-semibold text-fg">Email</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required placeholder="you@company.com"
            className="ease-fluid mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-fg transition-colors duration-500 outline-none placeholder:text-fg-3 focus-visible:border-safe"
          />
        </label>
        <button
          type="submit" disabled={busy}
          className="ease-fluid mt-4 w-full rounded-lg bg-accent px-3 py-3 text-base font-semibold text-fg transition-all duration-500 hover:bg-accent-2 active:scale-[0.99] disabled:opacity-30"
        >
          {busy ? 'Signing in…' : 'Continue with email'}
        </button>
        <p className="mt-4 text-xs text-pretty text-fg-3">
          <b className="font-medium text-fg-2">Email sign in is not verified.</b> It accepts any
          address you type and does not confirm you own it. Use Google above when you can — it
          actually proves who you are.(Testors with no mail can go through this)
        </p>
      </form>
    </div>
  );
}
