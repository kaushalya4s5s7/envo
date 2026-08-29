import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Today } from '@/components/today';
import { getCurrentAccount } from '@/lib/session';
import { getLatestBuildingForOrg } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Today — Envo',
  description: 'What the next twelve hours will do to your building, and what to do about it.',
};

/**
 * Without a capture id, this used to always show the committed demo day —
 * correct for a first-time visitor, but wrong for an org that has already
 * captured a building and just reloaded the tab. An explicit `?capture=` in
 * the URL always wins; this only fills in when there isn't one.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  if (!capture) {
    const account = await getCurrentAccount();
    const latest = account ? await getLatestBuildingForOrg(account.orgId) : null;
    if (latest) redirect(`/app?capture=${latest.id}`);
  }

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Suspense fallback={null}>
        <Today />
      </Suspense>
    </main>
  );
}
