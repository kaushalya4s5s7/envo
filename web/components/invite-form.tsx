'use client';

import { useState } from 'react';
import type { Role } from '@/lib/accounts-store';

/**
 * There is no email delivery here either — same honest gap as digest-form.tsx.
 * The invitation is real and takes effect the moment the invited email signs
 * in (see accounts-store.ts ensureMembership), but nothing is sent to tell
 * them it's waiting. Telling the person doing the inviting to say so
 * themselves, for now, is more honest than a "sent!" toast over nothing.
 */
export function InviteForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setError('');
    const r = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setError(body.error ?? 'Could not save that invite.'); setStatus('error'); return; }
    setStatus('saved');
    setEmail('');
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-3">
      <input
        type="email" required placeholder="teammate@company.com" value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-line-2 bg-ink px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:outline-none"
      />
      <select
        value={role} onChange={(e) => setRole(e.target.value as Role)}
        className="rounded-lg border border-line-2 bg-ink px-3 py-2 text-sm text-fg"
      >
        <option value="operator">Operator — can capture and override</option>
        <option value="viewer">Viewer — read only</option>
        <option value="owner">Owner — can also invite and grant autonomy</option>
      </select>
      <button
        type="submit"
        className="ease-fluid rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]"
      >
        Invite
      </button>
      {status === 'saved' ? (
        <span className="text-xs text-pretty text-fg-3">
          Saved. It takes effect the moment they sign in — tell them yourself, nothing is emailed.
        </span>
      ) : null}
      {error ? <span className="text-xs text-alert">{error}</span> : null}
    </form>
  );
}
