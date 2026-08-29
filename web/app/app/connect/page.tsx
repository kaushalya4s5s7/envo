import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { ProductionNote } from '@/components/production-note';
import { DeploymentSteps } from '@/components/deployment-steps';
import { Connect } from '@/components/connect';

export const metadata: Metadata = {
  title: 'Connect — Envo',
  description: 'Point discovery and mapping, the step that costs the industry months.',
};

export default function ConnectPage() {
  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={80} className="mb-12 flex w-full justify-center">
        <DeploymentSteps />
      </Reveal>
      <Reveal delay={120}>
        <h1 className="heading-gradient max-w-[760px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
          Ninety five points.<br />Four of them matter.
        </h1>
      </Reveal>
      <Reveal delay={230}>
        <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
          Mapping points by hand is 30 to 40% of BMS integration labour. We rank the candidates and
          explain every one, then a person confirms it. Nothing is applied from a guess.
        </p>
      </Reveal>
      <Reveal delay={340} className="mt-16 flex w-full justify-center">
        <Connect />
      </Reveal>
      <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
        <div className="rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink">
            <ProductionNote effort="months for a driver, weeks per site for the network">
              These points arrive over HTTP because BOPTEST speaks HTTP. Your building speaks
              BACnet/IP or Modbus on an OT network that is not reachable from the internet, so a
              real deployment puts a gateway on site and a driver behind this same screen. The
              mapping work you are doing here — ranking candidates, confirming each one — is
              identical either way, and it is the part that actually costs months.
            </ProductionNote>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
