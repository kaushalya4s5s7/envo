import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Reveal } from '@/components/reveal';
import { ProductionNote } from '@/components/production-note';
import { getCurrentAccount } from '@/lib/session';
import { listBuildingsForOrg } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Your buildings — Envelope Copilot',
  description: 'Choose a building to work on.',
};

/**
 * The portfolio.
 *
 * Two entries, and only one of them opens. The sandbox building is a full
 * deployment that happens to be simulated. The real building is deliberately
 * inert, because we have no BACnet transport and will not draw a door that
 * opens onto nothing.
 */
export default async function DashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect('/login');
  const buildings = await listBuildingsForOrg(account.orgId);

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={120}>
        <h1 className="heading-gradient max-w-[760px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-5xl md:leading-none">
          Your buildings.
        </h1>
      </Reveal>
      <Reveal delay={230}>
        <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
          Signed in as {account.email}, {account.role} of {account.orgName}. Pick a building to
          run the deployment against.
        </p>
      </Reveal>

      {buildings.length > 0 ? (
        <Reveal delay={280} className="mt-10 w-full max-w-[1120px]">
          <div className="rounded-2xl border border-line bg-surface p-2">
            <div className="rounded-lg border border-line bg-ink p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs tracking-wider text-fg-3">YOUR BUILDINGS</span>
                {buildings.length > 3 ? (
                  <a href="/app/buildings" className="font-mono text-xs text-fg-2 underline underline-offset-4">
                    See all {buildings.length} →
                  </a>
                ) : null}
              </div>
              <ul className="mt-3 divide-y divide-line">
                {buildings.slice(0, 3).map((b) => (
                  <li key={b.id}>
                    <a
                      href={`/app?capture=${b.id}`}
                      className="ease-fluid flex items-center justify-between gap-4 py-2 transition-opacity duration-300 hover:opacity-70"
                    >
                      <span className="text-sm text-fg">{b.address}</span>
                      <span className="tabular font-mono text-xs text-fg-3">
                        captured {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={340} className="mt-14 w-full max-w-[1120px]">
        <div className="grid gap-4 md:grid-cols-2">

          <a
            href="/onboarding"
            className="ease-fluid group rounded-2xl border border-line bg-surface p-2 transition-colors duration-500 hover:border-line-2"
          >
            <div className="flex h-full flex-col rounded-lg border border-line bg-ink p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs tracking-wider text-safe">READY</span>
                <span className="font-mono text-xs text-fg-3">SIMULATED</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">Reference medium office</h2>
              <p className="mt-1 text-sm text-pretty text-fg-2">
                Walk the whole deployment: place it on a map, read its local forecast, find its
                controls, watch it run, and see it scored. Five rooms and 95 controls, simulated
                by a US Department of Energy reference model.
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                <div>
                  <dt className="font-mono text-xs text-fg-3">ZONES</dt>
                  <dd className="tabular font-mono text-lg">5</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs text-fg-3">POINTS</dt>
                  <dd className="tabular font-mono text-lg">95</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs text-fg-3">STATUS</dt>
                  <dd className="font-mono text-lg text-safe">live</dd>
                </div>
              </dl>
              <span className="ease-fluid mt-4 inline-flex items-center gap-2 self-start rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 group-hover:bg-fg-2">
                Start at step one →
              </span>
            </div>
          </a>

          <div className="rounded-2xl border border-line bg-surface p-2 opacity-60">
            <div className="flex h-full flex-col rounded-lg border border-line bg-ink p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs tracking-wider text-fg-3">NOT AVAILABLE</span>
                <span className="font-mono text-xs text-fg-3">YOUR BUILDING</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-fg-2">
                Connect a real building
              </h2>
              <p className="mt-1 text-sm text-pretty text-fg-3">
                Same screens, same agent, same guardrails. What is missing is the transport: a
                BACnet or Modbus driver and a network path onto the building&rsquo;s OT network.
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                <div>
                  <dt className="font-mono text-xs text-fg-3">DRIVER</dt>
                  <dd className="font-mono text-lg text-fg-3">none</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs text-fg-3">GATEWAY</dt>
                  <dd className="font-mono text-lg text-fg-3">none</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs text-fg-3">STATUS</dt>
                  <dd className="font-mono text-lg text-fg-3">muted</dd>
                </div>
              </dl>
              <span className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-full border border-line-2 px-3 py-2 text-sm font-semibold text-fg-3">
                Requires a site gateway
              </span>
            </div>
          </div>

        </div>
      </Reveal>

      <Reveal delay={420} className="mt-6 w-full max-w-[1120px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink">
            <ProductionNote effort="weeks, and a per customer IT project">
              A real building appears here once a gateway is commissioned on site and a driver
              speaks to it. Everything after that point — discovery, mapping, shadow, autonomy —
              is the same software you are about to walk through, pointed at a different
              transport. That is the whole reason the sandbox is worth showing.
            </ProductionNote>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
