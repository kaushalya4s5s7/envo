import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { ProductionNote } from '@/components/production-note';
import { DeploymentSteps } from '@/components/deployment-steps';
import { Autonomy } from '@/components/autonomy';

export const metadata: Metadata = {
  title: 'Autonomy — Envo',
  description: 'Autonomy granted one actuator at a time, applied to a real captured day.',
};

export default function AutonomyPage() {
  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={80} className="mb-12 flex w-full justify-center">
        <DeploymentSteps />
      </Reveal>
      <Reveal delay={120}>
        <h1 className="heading-gradient max-w-[760px] text-center text-4xl text-balance md:text-6xl md:leading-none">
          One control<br />at a time.
        </h1>
      </Reveal>
      <Reveal delay={230}>
        <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
          Everything starts switched off. Turn one on and see exactly which of a real
          day&rsquo;s instructions would have reached the building, and which we would have kept
          to ourselves.
        </p>
      </Reveal>
      <Reveal delay={340} className="mt-16 flex w-full justify-center">
        <Autonomy />
      </Reveal>
      <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
        <div className="rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink">
            <ProductionNote effort="days, plus your change control process">
              The gate itself is finished and is the last thing a command passes. What a real
              deployment adds around it is durability and accountability: grants stored so they
              survive a restart, tied to the person who signed them, with an audit trail. A grant
              held only in memory is not a grant.
            </ProductionNote>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
