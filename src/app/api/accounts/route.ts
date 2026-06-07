import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { syncAccountsFromAkahu } from '@/lib/sync/accounts';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(accounts);
}

// POST: pull accounts from Akahu and upsert by stable identity (refreshes balances).
export async function POST() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accounts = await syncAccountsFromAkahu(userId);
    return NextResponse.json({ count: accounts.length, accounts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Akahu error' }, { status: 502 });
  }
}
