import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Reveal } from '@/components/reveal';
import { InviteForm } from '@/components/invite-form';
import { getCurrentAccount } from '@/lib/session';
import { listMembers, listPendingInvitations } from '@/lib/accounts-store';

export const metadata: Metadata = {
  title: 'Team — Envo',
  description: 'Who has access to this org, and what they can do.',
};

const ROLE_NOTE: Record<string, string> = {
  owner: 'Can capture, override, invite teammates, and is the only role that can grant autonomy.',
  operator: 'Can capture buildings and override or pause the agent.',
  viewer: 'Can see everything, changes nothing.',
};

/**
 * product-flow.md's own rule: viewer reads, operator overrides and pauses,
 * only owner grants autonomy. This page is where that becomes visible and
 * where an owner actually invites someone into it — real membership rows,
 * not a mock.
 */
export default async function TeamPage() {
  const account = await getCurrentAccount();
  if (!account) redirect('/login');

  const [members, pending] = await Promise.all([
    listMembers(account.orgId),
    listPendingInvitations(account.orgId),
  ]);

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[680px] text-center text-4xl text-balance md:text-6xl md:leading-none">
            {account.orgName}.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
            Every building above belongs to this org — invite a teammate and they see the same list.
          </p>
        </Reveal>

        <Reveal delay={340} className="mt-12 w-full max-w-[760px]">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2">
            <div className="rounded-lg border border-line bg-ink">
              <div className="border-b border-line px-4 py-3 font-mono text-xs tracking-wider text-fg-3">
                MEMBERS
              </div>
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <li key={m.userId} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="text-sm text-fg">{m.name ?? m.email}</span>
                      <span className="font-mono text-xs tracking-wider text-fg-2">{m.role.toUpperCase()}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-pretty text-fg-3">{ROLE_NOTE[m.role]}</p>
                  </li>
                ))}
              </ul>

              {pending.length > 0 ? (
                <>
                  <div className="border-t border-b border-line px-4 py-3 font-mono text-xs tracking-wider text-fg-3">
                    PENDING — TAKES EFFECT WHEN THEY SIGN IN
                  </div>
                  <ul className="divide-y divide-line">
                    {pending.map((inv) => (
                      <li key={inv.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                        <span className="text-sm text-fg-2">{inv.email}</span>
                        <span className="font-mono text-xs tracking-wider text-fg-3">{inv.role.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <div className="border-t border-line p-4">
                {account.role === 'owner' ? (
                  <InviteForm />
                ) : (
                  <p className="text-xs text-pretty text-fg-3">
                    Only an owner can invite teammates. Ask {members.find((m) => m.role === 'owner')?.email ?? 'the owner'}.
                  </p>
                )}
              </div>
            </div>
          </div>
      </Reveal>
    </main>
  );
}
