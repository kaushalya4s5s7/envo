import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GOOGLE_ENABLED } from '@/auth';
import { IslandNav } from '@/components/island-nav';
import { Reveal } from '@/components/reveal';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in — Envelope Copilot',
  description: 'Sign in to your buildings.',
};

export default function LoginPage() {
  return (
    <>
      <IslandNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
        <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[560px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-5xl md:leading-none">
            Sign in.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[520px] text-center text-base text-pretty text-fg-2">
            Your buildings, their plans for today, and the decision log behind every one.
          </p>
        </Reveal>
        <Reveal delay={340} className="mt-12 flex w-full justify-center">
          <Suspense fallback={null}>
            <LoginForm googleEnabled={GOOGLE_ENABLED} />
          </Suspense>
        </Reveal>
      </main>
    </>
  );
}
