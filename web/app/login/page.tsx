import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GOOGLE_ENABLED } from '@/auth';
import { Reveal } from '@/components/reveal';
import { LoginForm } from '@/components/login-form';
import { PixelMark } from '@/components/pixel-mark';

export const metadata: Metadata = {
  title: 'Sign in — Envelope Copilot',
  description: 'Sign in to your buildings.',
};

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-[480px]">
        <Reveal delay={80}>
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
            <PixelMark />
            Envelope Copilot
          </Link>
        </Reveal>
        <Reveal delay={160} className="mt-10">
          <h1 className="text-left text-4xl font-semibold tracking-tight text-fg text-balance">
            Sign in to Envelope Copilot.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-3 text-left text-base text-pretty text-fg-2">
            Your buildings, their plans for today, and the decision log behind every one.
          </p>
        </Reveal>
        <Reveal delay={340} className="mt-8">
          <Suspense fallback={null}>
            <LoginForm googleEnabled={GOOGLE_ENABLED} />
          </Suspense>
        </Reveal>
      </div>
    </main>
  );
}
