import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth';
import { syncUser } from '@/lib/sync/engine';
import { syncAccountsFromAkahu } from '@/lib/sync/accounts';
import { refreshAccountAndWait } from '@/lib/akahu';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

// POST /api/transactions/sync
// Server-enforced 1-hour cooldown. Refreshes all Akahu accounts then imports.
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let windowDays = 30;
  try {
    const b = await request.json();
    if (b?.windowDays) windowDays = Math.min(Math.max(1, Number(b.windowDays)), 365);
  } catch {}

  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, akahuId: true, lastSyncAt: true } });

  if (accounts.length === 0) {
    return NextResponse.json({ created: 0, updated: 0, confirmed: 0, flaggedReview: 0, nextSyncAt: null });
  }

  // Cooldown check (server-enforced): use the most recent lastSyncAt across all accounts
  const lastSyncTimes = accounts.map((a) => a.lastSyncAt?.getTime() ?? 0).filter((t) => t > 0);
  const lastSync = lastSyncTimes.length > 0 ? Math.max(...lastSyncTimes) : null;

  if (lastSync && Date.now() - lastSync < 60 * 60 * 1000) {
    const nextSyncAt = new Date(lastSync + 60 * 60 * 1000).toISOString();
    return NextResponse.json({ cooldown: true, nextSyncAt });
  }

  try {
    // Refresh all accounts at Akahu in parallel, tolerating individual failures
    await Promise.allSettled(accounts.map((a) => refreshAccountAndWait(a.akahuId, 20000)));

    // Refresh stored account balances from Akahu (best-effort — never fail the sync over this)
    try {
      await syncAccountsFromAkahu(userId);
    } catch (e) {
      console.error('Account balance refresh failed during sync:', e);
    }

    // Import transactions
    const result = await syncUser(userId, { windowDays });

    // Stamp cooldown only on success
    await prisma.account.updateMany({ where: { userId }, data: { lastSyncAt: new Date() } });

    const nextSyncAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return NextResponse.json({ ...result, nextSyncAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 502 });
  }
}
