import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/session';
import { subscribe, type Cadence } from '@/lib/digest-store';

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { buildingId, cadence } = (await request.json()) as { buildingId?: string; cadence?: Cadence };
  if (!buildingId || (cadence !== 'daily' && cadence !== 'weekly')) {
    return NextResponse.json({ error: 'Choose a building and a cadence.' }, { status: 400 });
  }
  await subscribe(account.userId, buildingId, cadence);
  return NextResponse.json({ ok: true });
}
