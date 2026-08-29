'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The deployment, as one sequence rather than a set of pages.
 *
 * The order a real building actually goes through. It starts outside the
 * building, because that is where our information comes from: an address binds
 * to a forecast square before anything indoors is touched. Only then do we look
 * for controls, watch, prove, and finally ask for any.
 *
 * The sandbox walks the identical path. Only the transport underneath differs,
 * and each step says so where it differs.
 */

const STEPS = [
  { href: '/onboarding', label: 'Locate the building', note: 'Address and local forecast' },
  { href: '/app/connect', label: 'Find its controls', note: 'Discover and map the points' },
  { href: '/app/building', label: 'Watch it run', note: 'Live conditions per room' },
  { href: '/app/sandbox', label: 'Prove it is worth it', note: 'Scored by someone else' },
  { href: '/app/autonomy', label: 'Grant control', note: 'One piece at a time' },
] as const;

export function DeploymentSteps() {
  const path = usePathname();
  const current = STEPS.findIndex((s) => s.href === path);
  const last = current === STEPS.length - 1;

  return (
    <nav aria-label="Deployment steps" className="w-full max-w-[1120px]">
      <ol className="flex flex-wrap items-stretch gap-2">
        {STEPS.map((s, i) => {
          const done = current > i;
          const active = current === i;
          return (
            <li key={s.href} className="min-w-[180px] flex-1">
              <Link
                href={s.href}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'ease-fluid flex h-full flex-col rounded-lg border px-3 py-2 transition-colors duration-500',
                  active ? 'border-safe bg-surface-2/40'
                    : done ? 'border-line text-fg-3 hover:border-line-2'
                    : 'border-line text-fg-3 opacity-70 hover:border-line-2 hover:opacity-100',
                )}
              >
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <i className={cn('block size-1.5 flex-none rounded-full',
                    active ? 'bg-safe' : done ? 'bg-fg-3' : 'bg-line-2')} />
                  STEP {i + 1}
                </span>
                <span className={cn('mt-1 text-sm font-medium', active ? 'text-fg' : 'text-fg-2')}>
                  {s.label}
                </span>
                <span className="text-xs text-fg-3">{s.note}</span>
              </Link>
            </li>
          );
        })}

        {/* Where the sequence ends up, so the last step is not a dead end. */}
        <li className="min-w-[150px] flex-1">
          <Link
            href="/app"
            className={cn(
              'ease-fluid flex h-full flex-col rounded-lg border border-dashed px-3 py-2 transition-colors duration-500',
              last ? 'border-safe' : 'border-line opacity-70 hover:opacity-100',
            )}
          >
            <span className="flex items-center gap-2 font-mono text-[11px] text-fg-3">
              <i className={cn('block size-1.5 flex-none rounded-full',
                last ? 'bg-safe' : 'bg-line-2')} />
              THEN, DAILY
            </span>
            <span className={cn('mt-1 text-sm font-medium', last ? 'text-fg' : 'text-fg-2')}>
              Your morning screen
            </span>
            <span className="text-xs text-fg-3">One look, then get on with it</span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}
