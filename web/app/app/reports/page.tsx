import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Reveal } from '@/components/reveal';
import { getCurrentAccount } from '@/lib/session';
import { buildOrgReport } from '@/lib/reports';

export const metadata: Metadata = {
  title: 'Reports — Envelope Copilot',
  description: 'Modeled savings and decisions across every building this org has captured.',
};

/**
 * Modeled, not measured, and said so on screen — honesty-rails.md. This is
 * not the priced attribution report the economic buyer eventually needs;
 * that depends on a real shadow-mode connection which doesn't exist yet.
 * This is what's honestly buildable today: what each capture's own twin
 * already computed, rolled up.
 */
export default async function ReportsPage() {
  const account = await getCurrentAccount();
  if (!account) redirect('/login');
  const report = await buildOrgReport(account.orgId);

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[680px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            Modeled, not measured.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2">
            Every number below is what each building&rsquo;s own twin computed at capture time,
            rolled up across {account.orgName}. Nothing here is a metered or priced result — that
            needs a real read-only connection to a building, which this org does not have yet.
          </p>
        </Reveal>

        {report.totals.captures === 0 ? (
          <Reveal delay={340} className="mt-12">
            <p className="text-center text-sm text-pretty text-fg-3">
              Nothing captured yet. <a href="/onboarding" className="text-fg-2 underline underline-offset-4">Capture a building</a> first.
            </p>
          </Reveal>
        ) : (
          <>
            <Reveal delay={340} className="mt-12 grid w-full max-w-[900px] grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: 'CAPTURES', value: report.totals.captures.toString() },
                { label: 'MODELED KWH SAVED / DAY', value: report.totals.totalDaySavedKwh.toFixed(1) },
                { label: 'AVG % SAVED / DAY', value: `${report.totals.averagePercentSaved.toFixed(1)}%` },
                { label: 'DECISIONS TAKEN', value: report.totals.totalDecisions.toString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-line bg-surface p-2">
                  <div className="rounded-lg border border-line bg-ink p-4">
                    <div className="font-mono text-xs tracking-wider text-fg-3">{stat.label}</div>
                    <div className="tabular mt-1 font-mono text-2xl text-fg">{stat.value}</div>
                  </div>
                </div>
              ))}
            </Reveal>

            <Reveal delay={420} className="mt-6 w-full max-w-[900px]">
              <div className="overflow-x-auto overflow-hidden rounded-2xl border border-line bg-surface p-2">
                <div className="rounded-lg border border-line bg-ink">
                  <table className="w-full min-w-[600px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 text-left font-mono text-xs font-normal tracking-wider text-fg-3">
                          BUILDING
                        </th>
                        <th className="px-4 py-3 text-right font-mono text-xs font-normal tracking-wider text-fg-3">
                          CAPTURES
                        </th>
                        <th className="px-4 py-3 text-right font-mono text-xs font-normal tracking-wider text-fg-3">
                          KWH SAVED / DAY
                        </th>
                        <th className="px-4 py-3 text-right font-mono text-xs font-normal tracking-wider text-fg-3">
                          AVG % SAVED
                        </th>
                        <th className="px-4 py-3 text-right font-mono text-xs font-normal tracking-wider text-fg-3">
                          DECISIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.buildings.map((b) => (
                        <tr key={b.buildingId} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3 text-fg">{b.address}</td>
                          <td className="tabular px-4 py-3 text-right font-mono text-fg-2">{b.captures}</td>
                          <td className="tabular px-4 py-3 text-right font-mono text-fg-2">
                            {b.totalDaySavedKwh.toFixed(1)}
                          </td>
                          <td className="tabular px-4 py-3 text-right font-mono text-fg-2">
                            {b.averagePercentSaved.toFixed(1)}%
                          </td>
                          <td className="tabular px-4 py-3 text-right font-mono text-fg-2">{b.totalDecisions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
        </>
      )}
    </main>
  );
}
