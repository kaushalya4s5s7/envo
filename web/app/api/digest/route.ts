import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { subscribe, type Cadence } from '@/lib/digest-store';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { buildingId, cadence } = (await request.json()) as { buildingId?: string; cadence?: Cadence };
  if (!buildingId || (cadence !== 'daily' && cadence !== 'weekly')) {
    return NextResponse.json({ error: 'Choose a building and a cadence.' }, { status: 400 });
  }
  subscribe(session.user.email, buildingId, cadence);
  return NextResponse.json({ ok: true });
}
