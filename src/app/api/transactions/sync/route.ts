import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth';
import { syncUser } from '@/lib/sync/engine';

// POST /api/transactions/sync  body: { full?: boolean }
// full = wider window to self-heal historical gaps.
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let full = false;
  try { full = (await request.json())?.full === true; } catch { /* no body */ }

  try {
    const result = await syncUser(userId, { windowDays: full ? 365 : 14 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 502 });
  }
}
