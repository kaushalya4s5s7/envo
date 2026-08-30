import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { DeploymentSteps } from '@/components/deployment-steps';
import { ProductionNote } from '@/components/production-note';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = {
  title: 'Get started — Envo',
  description:
    'Type an address, confirm your block on a real heatmap, and see your building’s day. No hardware, no BMS credentials, no site survey.',
};

export default function OnboardingPage() {
  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={80} className="mb-12 flex w-full justify-center">
        <DeploymentSteps />
      </Reveal>
      <Reveal delay={120} className="w-full max-w-[560px]">
        <h1 className="display text-left text-4xl text-fg text-balance">
          An address is enough to start.
        </h1>
      </Reveal>
      <Reveal delay={230} className="w-full max-w-[560px]">
        <p className="mt-3 text-left text-base text-pretty text-fg-2">
          Every other product in this category installs a gateway and learns your building for six
          to eight weeks first. Our intelligence comes from outside it, so the first answer arrives
          before you have granted us anything at all.
        </p>
      </Reveal>
      <Reveal delay={340} className="mt-16 flex w-full justify-center">
        <Onboarding />
      </Reveal>
      <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
        <div className="rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink">
            <ProductionNote effort="none, this step is already real">
              This step is identical for a real building. The address, the map, and the forecast
              are live for whatever you type, because none of it needs anything inside the
              building. It is the reason the first useful answer arrives before any installation.
            </ProductionNote>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
