import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppNav } from '@/components/app-nav';
import { Today } from '@/components/today';

export const metadata: Metadata = {
  title: 'Today — Envelope Copilot',
  description: 'What the next twelve hours will do to your building, and what to do about it.',
};

export default function AppPage() {
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
