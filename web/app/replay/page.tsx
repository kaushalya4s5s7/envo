import type { Metadata } from 'next';
import { IslandNav } from '@/components/island-nav';
import { Reveal } from '@/components/reveal';
import { Replay } from '@/components/replay';
import { AgentPanel } from '@/components/agent-panel';
import { run } from '@/lib/data';

export const metadata: Metadata = {
  title: 'The replay — Envelope Copilot',
  description:
    'A real captured FortyGuard day, run through Envelope Copilot and through a citywide weather baseline. Same loop, same building, different signal.',
};

export default function ReplayPage() {
  return (
    <>
      <IslandNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
        <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[680px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            One day.<br />Two controllers.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
            {run.date} in Manhattan, captured from FortyGuard. Both controllers run the identical loop
            against the identical building. Only the signal each one gets is different, and that is the
            whole experiment.
          </p>
        </Reveal>
        <Reveal delay={340} className="mt-16 flex w-full justify-center">
          <Replay />
        </Reveal>
        <Reveal delay={120} className="mt-8 flex w-full justify-center">
          <AgentPanel />
        </Reveal>
      </main>
    </>
  );
}
