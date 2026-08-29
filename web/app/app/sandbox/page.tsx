import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { ProductionNote } from '@/components/production-note';
import { DeploymentSteps } from '@/components/deployment-steps';
import { Sandbox } from '@/components/sandbox';

export const metadata: Metadata = {
  title: 'Sandbox — Envelope Copilot',
  description:
    'The agent drives an IBPSA and US Department of Energy building emulator, and the emulator does the scoring.',
};

export default function SandboxPage() {
  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={80} className="mb-12 flex w-full justify-center">
        <DeploymentSteps />
      </Reveal>
      <Reveal delay={120}>
        <h1 className="heading-gradient max-w-[760px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
          We let someone else<br />mark our homework.
        </h1>
      </Reveal>
      <Reveal delay={230}>
        <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
          Nobody hands over their building to software they have not watched work. So the agent
          runs a full day inside a building simulator built by the US Department of Energy, and
          that simulator scores the result on energy, cost, comfort and air quality.
        </p>
      </Reveal>
      <Reveal delay={340} className="mt-16 flex w-full justify-center">
        <Sandbox />
      </Reveal>
      <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
        <div className="rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink">
            <ProductionNote effort="one billing cycle to establish a baseline">
              An emulator can be asked to run the same day twice, which is what makes this
              comparison possible at all. A real building cannot. So in production this step
              becomes shadow mode: we log what we would have done, compare it against what the
              building actually did, and price the difference against your meter before anyone is
              asked to grant control.
            </ProductionNote>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
