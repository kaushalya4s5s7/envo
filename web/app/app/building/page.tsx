import type { Metadata } from 'next';
import { AppNav } from '@/components/app-nav';
import { Reveal } from '@/components/reveal';
import { ProductionNote } from '@/components/production-note';
import { DeploymentSteps } from '@/components/deployment-steps';
import { Building } from '@/components/building';

export const metadata: Metadata = {
  title: 'The building — Envelope Copilot',
  description: 'Live zone conditions, equipment state, and the commands the agent is issuing.',
};

export default function BuildingPage() {
  return (
    <>
      <AppNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[140px]">
        <Reveal delay={80} className="mb-12 flex w-full justify-center">
          <DeploymentSteps />
        </Reveal>
        <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[760px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            Five zones.<br />One agent driving.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
            Play the day and watch the west facade heat, the dampers move, and CO₂ climb — computed
            by a Department of Energy reference model, not by us.
          </p>
        </Reveal>
        <Reveal delay={340} className="mt-16 flex w-full justify-center">
          <Building />
        </Reveal>
        <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
          <div className="rounded-2xl border border-line bg-surface p-2">
            <div className="rounded-lg border border-line bg-ink">
              <ProductionNote effort="no change to this screen">
                Every value here is read back from the model after a command is applied. Against a
                real building the same loop reads from the points you confirmed on the previous
                step. What has to be added is not this view but what sits under it: a watchdog that
                returns the building to its own control if we stop responding, and detection for an
                operator turning a knob by hand.
              </ProductionNote>
            </div>
          </div>
        </Reveal>
      </main>
    </>
  );
}
