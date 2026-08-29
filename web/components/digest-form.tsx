'use client';

import { useState } from 'react';

/**
 * Captures intent, does not send anything. There is no email pipeline yet —
 * see docs/decisions/product/operator-product-shape.md, "still open." Saying
 * otherwise here would be the exact thing honesty-rails.md forbids.
 */
export function DigestForm({ buildingId }: { buildingId: string }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = async (cadence: 'daily' | 'weekly') => {
    setError('');
    const r = await fetch('/api/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingId, cadence }),
    });
    if (!r.ok) { setError('Could not save that.'); return; }
    setSaved(true);
  };

  if (saved) {
    return (
      <p className="mt-2 text-xs text-pretty text-fg-3">
        Saved to your account. Nothing is emailed yet — this only proves the preference is real
        before the sending part is built.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <span className="text-xs text-fg-3">Email me this building&rsquo;s brief:</span>
      <button
        type="button" onClick={() => void submit('daily')}
        className="rounded-full border border-line-2 px-3 py-1 text-xs font-medium text-fg-2 hover:bg-ink"
      >
        Daily
      </button>
      <button
        type="button" onClick={() => void submit('weekly')}
        className="rounded-full border border-line-2 px-3 py-1 text-xs font-medium text-fg-2 hover:bg-ink"
      >
        Weekly
      </button>
      {error ? <span className="text-xs text-alert">{error}</span> : null}
    </div>
  );
}
