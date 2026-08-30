'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PixelMark } from './pixel-mark';

const LINKS = [
  { href: '#problem', id: 'problem', label: 'The signal' },
  { href: '#how', id: 'how', label: 'How it works' },
  { href: '#evidence', id: 'evidence', label: 'The evidence' },
] as const;

export function PreviewNav() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const sentinel = document.getElementById('preview-nav-sentinel');
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => {
      setCompact(!entry?.isIntersecting);
    }, { threshold: 0 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const nodes = LINKS
      .map((link) => document.getElementById(link.id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0.15, 0.4, 0.7] });

    for (const node of nodes) io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div id="preview-nav-sentinel" className="pointer-events-none absolute top-0 h-1 w-full" aria-hidden="true" />

      <div className="pointer-events-none fixed inset-x-0 top-10 z-50 flex justify-center px-5 pt-4">
        <nav
          aria-label="Primary"
          className={cn(
            'pointer-events-auto relative w-full max-w-[1164px] border border-line bg-[#0B0907] transition-all duration-700 ease-fluid',
            compact ? 'py-2' : 'py-3',
          )}
        >
          <span className="pointer-events-none absolute -left-px -top-px size-3 border-l border-t border-[#DDD8D5]" aria-hidden="true" />
          <span className="pointer-events-none absolute -right-px -top-px size-3 border-r border-t border-[#DDD8D5]" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-px -left-px size-3 border-b border-l border-[#DDD8D5]" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-px -right-px size-3 border-b border-r border-[#DDD8D5]" aria-hidden="true" />

          <div className="flex items-center justify-between gap-6 px-4 md:px-5">
            <Link href="/" aria-current="page" className="flex items-center gap-2 text-sm font-medium tracking-tight">
              <PixelMark />
              <span>Envo</span>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {LINKS.map((link) => (
                <PreviewLink key={link.href} href={link.href} active={active === link.id}>
                  {link.label}
                </PreviewLink>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden rounded-sm bg-[#DDD8D5] px-3 py-2 text-sm font-medium text-[#0B0907] transition-all duration-300 ease-out hover:bg-fg active:scale-[0.98] md:inline-flex"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="preview-nav-sheet"
                aria-label={open ? 'Close menu' : 'Open menu'}
                className="relative size-9 md:hidden"
              >
                <span
                  className={cn(
                    'ease-fluid absolute left-[9px] block h-[1.5px] w-[18px] bg-fg transition-all duration-700',
                    open ? 'top-[17px] rotate-45' : 'top-3',
                  )}
                />
                <span
                  className={cn(
                    'ease-fluid absolute left-[9px] block h-[1.5px] w-[18px] bg-fg transition-all duration-700',
                    open ? 'top-[17px] -rotate-45' : 'top-[22px]',
                  )}
                />
              </button>
            </div>
          </div>
        </nav>
      </div>

      <div
        id="preview-nav-sheet"
        onClick={(event) => { if ((event.target as HTMLElement).tagName === 'A') setOpen(false); }}
        className={cn(
          'ease-fluid fixed inset-0 z-40 flex flex-col justify-center gap-6 bg-[#0B0907] px-8 transition-all duration-700',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        {LINKS.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ transitionDelay: open ? `${100 + index * 50}ms` : '0ms' }}
            className={cn(
              'ease-fluid display text-5xl transition-all duration-700',
              open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0',
            )}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/login"
          style={{ transitionDelay: open ? '250ms' : '0ms' }}
          className={cn(
            'ease-fluid mt-4 inline-flex w-max rounded-sm bg-[#DDD8D5] px-3 py-2 text-base font-medium text-[#0B0907] transition-all duration-700',
            open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0',
          )}
        >
          Sign in
        </Link>
      </div>
    </>
  );
}

function PreviewLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className="group relative px-3 py-2 text-sm text-fg-2 transition-colors duration-500 ease-fluid hover:text-fg"
    >
      {children}
      <span
        className={cn(
          'ease-fluid absolute inset-x-3 bottom-1 h-px origin-left bg-[#FF8B3E] transition-transform duration-700',
          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
        )}
      />
    </Link>
  );
}
