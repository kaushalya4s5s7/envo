/**
 * What this step would be against real equipment.
 *
 * Every place the sandbox stands in for a building carries one of these. The
 * demo is only honest if the substitution is named at the moment it happens,
 * rather than disclosed once at the start and quietly relied on afterwards.
 *
 * `effort` is our own estimate of the remaining work and is labelled as such —
 * see docs/decisions/product/honesty-rails.md.
 */
export function ProductionNote({
  children, effort,
}: {
  children: React.ReactNode;
  effort?: string;
}) {
  return (
    <aside className="border-l-2 border-line-2 bg-surface-2/40 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs tracking-wider text-fg-3">IN PRODUCTION</span>
        {effort ? (
          <span className="font-mono text-xs text-fg-3/70">est. {effort}</span>
        ) : null}
      </div>
      <p className="mt-1.5 max-w-[760px] text-sm text-pretty text-fg-2">{children}</p>
    </aside>
  );
}
