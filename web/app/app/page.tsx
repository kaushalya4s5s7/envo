import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppNav } from '@/components/app-nav';
import { Today } from '@/components/today';
import { getLatestBuildingForUser } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Today — Envelope Copilot',
  description: 'What the next twelve hours will do to your building, and what to do about it.',
};

/**
 * Without a capture id, this used to always show the committed demo day —
 * correct for a first-time visitor, but wrong for someone who has already
 * captured their own building and just reloaded the tab. An explicit
 * `?capture=` in the URL always wins; this only fills in when there isn't one.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  if (!capture) {
    const session = await auth();
    const latest = session?.user?.email ? getLatestBuildingForUser(session.user.email) : null;
    if (latest) redirect(`/app?capture=${latest.id}`);
  }

  return (
    <>
      <AppNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
        <Suspense fallback={null}>
          <Today />
        </Suspense>
      </main>
    </>
  );
}
