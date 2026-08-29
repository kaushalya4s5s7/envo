'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PixelMark } from './pixel-mark';

/**
 * Every authenticated page's chrome. Was a floating top pill nav
 * (island-nav.tsx's 'app' variant) — moved to a persistent left sidebar so
 * five links (Portfolio, Today's Brief, Decision Log, Reports, Team) don't
 * have to compete for space in a single floating bar. Marketing pages keep
 * the pill nav (island-nav.tsx); this is authenticated-app-only.
 *
 * Icons are hand-drawn inline SVG, not an icon library — matches every other
 * icon already in this codebase (PixelMark, the Google mark, the hamburger).
 * Regular-weight line style per .agents/skills/design-skills.md B6.
 */

function IconPortfolio() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none">
      <rect x="4" y="3" width="8" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12.5" y="8" width="3.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 6.25h1M9.5 6.25h1M6.5 9.25h1M9.5 9.25h1M6.5 12.25h1M9.5 12.25h1"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBrief() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none">
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 3.5v-0.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v0.75"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8.5h6M7 11.5h6M7 14.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLog() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none">
      <circle cx="5" cy="5.5" r="1" fill="currentColor" />
      <path d="M8.5 5.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="14.5" r="1" fill="currentColor" />
      <path d="M8.5 14.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none">
      <rect x="4" y="11" width="3" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="7" width="3" height="9.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="3.5" width="3" height="13" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none">
      <circle cx="7.25" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14.25" cy="7.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.75 11.25c1.8-0.25 3.7 0.85 4.6 2.85"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const LINKS = [
  { href: '/dashboard', label: 'Portfolio', icon: IconPortfolio },
  { href: '/app', label: 'Today’s Brief', icon: IconBrief },
  { href: '/app/decisions', label: 'Decision Log', icon: IconLog },
  { href: '/app/reports', label: 'Reports', icon: IconReports },
  { href: '/app/team', label: 'Team', icon: IconTeam },
];

export function AppSidebar({ user, orgName }: { user?: string; orgName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // '/app' must match exactly — every other /app/* route would otherwise
  // also light up "Today's Brief" as active via a naive startsWith check.
  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

  const NavLinks = () => (
    <nav aria-label="Primary" className="mt-8 flex flex-col gap-1">
      {LINKS.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={cn(
              'ease-fluid flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-300',
              isActive(l.href) ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:bg-surface-2/60 hover:text-fg',
            )}
          >
            <Icon />
            {l.label}
          </Link>
        );
      })}
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
