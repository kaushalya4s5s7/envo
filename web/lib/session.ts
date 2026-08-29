import { cache } from 'react';
import { auth } from '@/auth';
import { ensureUser, ensureMembership, getPrimaryOrg, type Role } from './accounts-store';

export interface CurrentAccount {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  orgName: string;
  role: Role;
}

/**
 * The single call site every page/route uses to get "who is asking, and on
 * behalf of which org." Bootstraps the user + org + membership rows on
 * first touch — see accounts-store.ts — so nothing upstream needs a
 * separate sign-up step. `cache()` dedupes repeat calls within one request.
 */
export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  const authSession = await auth();
  const email = authSession?.user?.email;
  if (!email) return null;
  const name = authSession.user?.name ?? null;

  const user = await ensureUser(email, name);
  await ensureMembership(user.id, email, name);
  const org = await getPrimaryOrg(user.id);
  if (!org) return null;

  return {
    userId: user.id, email: user.email, name: user.name,
    orgId: org.orgId, orgName: org.orgName, role: org.role,
  };
});
