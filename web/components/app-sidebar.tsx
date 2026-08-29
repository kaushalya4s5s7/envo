'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PixelMark } from './pixel-mark';

/**
 * Every authenticated page's chrome. Was a floating top pill nav
 * (island-nav.tsx's 'app' variant) — moved to a persistent left sidebar so
 * five links (Buildings, Today, Decisions, Reports, Team) don't have to
 * compete for space in a single floating bar. Marketing pages keep the
 * pill nav (island-nav.tsx); this is authenticated-app-only.
 */
const LINKS = [
  { href: '/dashboard', label: 'Buildings' },
  { href: '/app', label: 'Today' },
  { href: '/app/decisions', label: 'Decisions' },
  { href: '/app/reports', label: 'Reports' },
  { href: '/app/team', label: 'Team' },
];

export function AppSidebar({ user, orgName }: { user?: string; orgName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // '/app' must match exactly — every other /app/* route would otherwise
  // also light up "Today" as active via a naive startsWith check.
  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

  const NavLinks = () => (
    <nav aria-label="Primary" className="mt-8 flex flex-col gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(l.href) ? 'page' : undefined}
          className={cn(
            'ease-fluid rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-300',
            isActive(l.href) ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:bg-surface-2/60 hover:text-fg',
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  const Identity = () => (
    <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
      {orgName ? <span className="truncate px-3 font-mono text-xs text-fg-3">{orgName}</span> : null}
      {user ? (
        <span className="truncate px-3 font-mono text-xs text-fg-3" title={user}>{user}</span>
      ) : null}
      <a
        href="/api/auth/signout"
        className="ease-fluid rounded-lg px-3 py-2 text-sm font-medium text-fg-2 transition-colors duration-300 hover:bg-surface-2/60 hover:text-fg"
      >
        Sign out
      </a>
    </div>
  );

  return (
    <>
      {/* Desktop: persistent left sidebar, out of document flow. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface-2/60 p-4 backdrop-blur-xl md:flex">
        <Link href="/" className="flex items-center gap-2 px-2 text-sm font-semibold tracking-tight">
          <PixelMark />
          Envelope Copilot
        </Link>
        <NavLinks />
        <Identity />
      </aside>

      {/* Mobile: slim top bar with a hamburger into a full-screen sheet. */}
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <PixelMark />
          Envelope Copilot
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-sidebar-sheet"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="relative size-9 flex-none"
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
      </div>
      <div
        id="app-sidebar-sheet"
        onClick={(e) => { if ((e.target as HTMLElement).tagName === 'A') setOpen(false); }}
        className={cn(
          'ease-fluid fixed inset-0 z-40 flex flex-col bg-ink/95 p-6 pt-24 backdrop-blur-3xl transition-all duration-500 md:hidden',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        <NavLinks />
        <Identity />
      </div>
    </>
  );
}
