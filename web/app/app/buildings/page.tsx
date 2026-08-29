import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Reveal } from '@/components/reveal';
import { getCurrentAccount } from '@/lib/session';
import { listBuildingsForOrg } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Your buildings — Envo',
  description: 'Every building your org has captured, and when.',
};

/**
 * A list, deliberately. Not a map — Runwise's residential-super framing
 * doesn't fit this buyer — and not a benchmarked analytics table, which
 * who-we-build-for.md already rejected. Same one-line-per-action instinct as
 * the rest of the app: an address and when it was captured, nothing more.
 * Org-scoped, so a teammate sees the same list, not just their own captures.
 */
export default async function BuildingsPage() {
  const account = await getCurrentAccount();
  if (!account) redirect('/login');
  const buildings = await listBuildingsForOrg(account.orgId);

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[680px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            Your buildings.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
            Every address {account.orgName} has captured, most recent first.
          </p>
        </Reveal>

        <Reveal delay={340} className="mt-12 w-full max-w-[760px]">
          {buildings.length === 0 ? (
            <p className="text-center text-sm text-pretty text-fg-3">
              Nothing captured yet.{' '}
              <Link href="/onboarding" className="text-fg-2 underline underline-offset-4">
                Type an address
              </Link>{' '}
              to capture your first one.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {buildings.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/app?capture=${b.id}`}
                    className="ease-fluid flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-300 hover:bg-ink"
                  >
                    <span className="text-sm text-fg">{b.address}</span>
                    <span className="tabular font-mono text-xs text-fg-3">
                      captured {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </Reveal>
    </main>
  );
}
