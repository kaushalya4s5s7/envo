import agent from '@/lib/agent.json';
import { clock } from '@/lib/data';

/**
 * The agent's work, rendered from a build-time artifact.
 *
 * The model runs in `bun enrich.ts`, never in the browser and never during a
 * demo — docs/decisions/platform/determinism.md forbids a network call on stage,
 * and that applies to a model as much as to a vendor API.
 */
export function AgentPanel() {
  const refused = agent.turns.filter((t) => !t.accepted);
  const meanMs = Math.round(agent.turns.reduce((s, t) => s + t.latencyMs, 0) / agent.turns.length);

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            AGENT <b className="font-medium text-fg-2">{agent.model}</b> · {agent.turns.length} turns ·
            {' '}{meanMs} ms mean
          </span>
          <span className="font-mono text-xs text-fg-3">
            RAILS <b className={refused.length ? 'text-alert' : 'text-safe'}>
              {refused.length} refused
            </b> of {agent.turns.length}
          </span>
        </header>

        <div className="border-b border-line p-4">
          <div className="font-mono text-xs tracking-wider text-fg-3">THE DAY, IN THE AGENT&rsquo;S WORDS</div>
          <p className="mt-2 text-sm text-pretty text-fg-2">{agent.summary}</p>
          <p className="mt-2 text-xs text-fg-3">
            Every figure above was checked against the captured fixture. The agent was told not to
            present modeled values as measured, and it did not.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs text-fg-3">
                <th className="p-3 font-medium">HOUR</th>
                <th className="p-3 font-medium">SAW</th>
                <th className="p-3 font-medium text-fg">AGENT PROPOSED</th>
                <th className="p-3 font-medium">RAILS</th>
                <th className="p-3 font-medium">ms</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono text-xs">
              {agent.turns.map((t) => {
                const c = t.llmCommand as Record<string, unknown>;
                return (
                  <tr key={t.at} className="border-b border-line align-top">
                    <td className="p-3 text-fg-2">{clock(t.at)}</td>
                    <td className="p-3 text-fg-3">{t.proposalsSeen} proposal{t.proposalsSeen === 1 ? '' : 's'}</td>
                    <td className="p-3">
                      <span className="text-fg-2">{String(c?.['actuator'] ?? 'malformed')}</span>
                      {c?.['setpointF'] !== undefined ? ` → ${String(c['setpointF'])} °F` : null}
                      {c?.['outsideAirFraction'] !== undefined
                        ? ` → ${String(c['outsideAirFraction'])} ${String(c['mode'] ?? '')}` : null}
                      <div className="mt-1 max-w-[380px] font-sans text-xs text-pretty text-fg-3">
                        {t.llmRationale}
                      </div>
                    </td>
                    <td className={`p-3 ${t.accepted ? 'text-safe' : 'text-alert'}`}>
                      {t.accepted ? 'passed' : (t as { rail?: string }).rail}
                    </td>
                    <td className="p-3 text-fg-3">{t.latencyMs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/*
          A recorded incident, not a staged one. Keeping it visible matters more
          than a clean scoreboard: it is the only direct evidence the rails work.
        */}
        <div className="border-t border-line p-4">
          <div className="font-mono text-xs tracking-wider text-fg-3">RECORDED INCIDENT</div>
          <p className="mt-2 text-sm text-pretty text-fg-2">
            On its first live call this agent proposed{' '}
            <b className="font-mono text-alert">setpointF: 740.0000000000001</b>. The comfort rail
            refused it: <i className="not-italic text-fg-3">&ldquo;A setpoint of 740 °F falls outside the
            occupied comfort band of {agent.guardrails.comfortBand[0]} to {agent.guardrails.comfortBand[1]} °F.
            Comfort bounds are a hard constraint that energy optimisation is not permitted to trade
            away.&rdquo;</i>
          </p>
          <p className="mt-2 text-xs text-pretty text-fg-3">
            The model proposes. It does not drive. The building is steered by the deterministic
            result, and the agent&rsquo;s proposal is recorded and judged beside it — the same way a new
            operator works in shadow before being given the keys.
          </p>
        </div>

      </div>
    </div>
  );
}
