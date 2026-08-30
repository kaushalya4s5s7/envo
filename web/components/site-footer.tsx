import Link from 'next/link';
import { PixelMark } from './pixel-mark';

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface px-6 pt-12 pb-8 md:pt-16">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-12">
          <div>
            <Link href="/" className="group inline-flex items-center gap-2">
              <PixelMark monochrome />
              <span className="text-xl font-medium tracking-tight text-fg transition-colors duration-700 ease-fluid group-hover:text-fg-2">
                Envo
              </span>
            </Link>
            <p className="mt-4 max-w-[360px] text-sm text-pretty text-fg-2">
              Outdoor intelligence for buildings that already have the controls.
            </p>
            <Link
              href="/replay"
              className="ease-fluid mt-6 inline-flex items-center gap-2 rounded-full border border-line-2 px-3 py-2 text-sm font-medium text-fg transition-all duration-500 hover:border-fg-3 hover:bg-surface-2 active:scale-[0.98]"
            >
              Open the replay
              <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M40 128h176M152 64l64 64-64 64" stroke="currentColor" strokeWidth="20"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <FooterColumn
            title="Explore"
            links={[
              { href: '/#how', label: 'How it works' },
              { href: '/#proof', label: 'The evidence' },
              { href: '/replay', label: 'See a real day' },
            ]}
          />
          <FooterColumn
            title="Start here"
            links={[
              { href: '/onboarding', label: 'Try a building' },
              { href: '/login', label: 'Sign in' },
              { href: '/replay', label: 'Open the replay' },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-fg-3 md:flex-row md:items-center md:justify-between">
          <span>ENVO · OUTDOOR INTELLIGENCE</span>
          <span>Simulation and advisory only. No real equipment is controlled.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-xs tracking-wider text-fg-3">{title.toUpperCase()}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-fg-2 transition-colors duration-500 ease-fluid hover:text-fg"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
