import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/session';
import { createInvitation, type Role } from '@/lib/accounts-store';

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (account.role !== 'owner') {
    return NextResponse.json({ error: 'Only an owner can invite teammates.' }, { status: 403 });
  }
  const { email, role } = (await request.json()) as { email?: string; role?: Role };
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  }
  if (role !== 'owner' && role !== 'operator' && role !== 'viewer') {
    return NextResponse.json({ error: 'Choose a role.' }, { status: 400 });
  }
  const invitation = await createInvitation(account.orgId, trimmed, role, account.userId);
  return NextResponse.json({ ok: true, invitation });
}
