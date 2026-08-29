'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { PixelMark } from './pixel-mark';

/**
 * Two navigations, because they serve two different people.
 *
 * A visitor needs to understand what this is and where to sign in. Somebody
 * signed in needs to move between their buildings. Putting app links on the
 * marketing page only offered a row of doors that redirect to a login.
 */
const MARKETING = [
  { href: '/#how', label: 'How it works' },
  { href: '/#proof', label: 'The evidence' },
  { href: '/replay', label: 'See a real day' },
];

const APP = [
  { href: '/dashboard', label: 'Buildings' },
  { href: '/app', label: 'Today' },
  { href: '/app/decisions', label: 'Decisions' },
  { href: '/app/reports', label: 'Reports' },
  { href: '/app/team', label: 'Team' },
];

export type NavVariant = 'marketing' | 'app';

export function IslandNav(
  { variant = 'marketing', user }: { variant?: NavVariant; user?: string } = {},
) {
  const [open, setOpen] = useState(false);
  const links = variant === 'app' ? APP : MARKETING;
  // An app page with no session is a dropped cookie, not a normal state, so it
  // offers a way back in rather than a sign out that would do nothing.
  const action = variant === 'app' && user
    ? { href: '/api/auth/signout', label: 'Sign out' }
    : { href: '/login', label: user ? 'Sign out' : 'Sign in' };

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-6">
        <nav
          aria-label="Primary"
          className="ease-fluid pointer-events-auto flex w-max items-center gap-6 rounded-full border border-line-2 bg-surface-2/60 py-2 pr-2 pl-6 backdrop-blur-xl transition-all duration-700 hover:border-[#3d3d3d] max-md:gap-4 max-md:pl-4"
        >
          <a href="/" aria-current="page" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <PixelMark />
            Envelope Copilot
          </a>

          <div className="flex items-center gap-6 max-md:hidden">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="ease-fluid text-sm font-medium text-fg-2 transition-colors duration-500 hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </div>

          {user ? (
            <span className="font-mono text-xs text-fg-3 max-lg:hidden" title={user}>
              {user}
            </span>
          ) : null}

          <a
            href={action.href}
            className="ease-fluid inline-flex items-center rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98] max-md:hidden"
          >
            {action.label}
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="nav-sheet"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="relative size-9 flex-none rounded-full md:hidden"
          >
            <span
              className={cn(
                'ease-fluid absolute left-[9px] block h-[1.5px] w-[18px] rounded-full bg-fg transition-all duration-700',
                open ? 'top-[19px] rotate-45' : 'top-4',
              )}
            />
            <span
              className={cn(
                'ease-fluid absolute left-[9px] block h-[1.5px] w-[18px] rounded-full bg-fg transition-all duration-700',
                open ? 'top-[19px] -rotate-45' : 'top-[22px]',
              )}
            />
          </button>
        </nav>
      </div>

      <div
        id="nav-sheet"
        onClick={(e) => { if ((e.target as HTMLElement).tagName === 'A') setOpen(false); }}
        className={cn(
          'ease-fluid fixed inset-0 z-40 flex flex-col justify-center gap-6 bg-ink/80 p-12 backdrop-blur-3xl transition-all duration-700',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        {[...links, action].map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            style={{ transitionDelay: open ? `${100 + i * 50}ms` : '0ms' }}
            className={cn(
              'ease-fluid text-4xl font-semibold tracking-tight transition-all duration-700',
              open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0',
            )}
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  );
}
