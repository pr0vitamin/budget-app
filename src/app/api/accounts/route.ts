import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { getAccounts as getAkahuAccounts } from '@/lib/akahu';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(accounts);
}

// POST: pull accounts from Akahu and upsert by STABLE identity (account number
// if present, else akahuId) so reconnection updates the same row, never dupes.
export async function POST() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let akahuAccounts;
  try {
    akahuAccounts = await getAkahuAccounts();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Akahu error' }, { status: 502 });
  }

  const existing = await prisma.account.findMany({ where: { userId } });

  for (const a of akahuAccounts) {
    const accountNumber = a.formatted_account ?? null;
    const fields = {
      akahuId: a._id,
      accountNumber,
      name: a.name,
      institution: a.connection.name,
      accountType: a.type.toLowerCase(),
      balanceCurrent: a.balance?.current ?? null,
      balanceAvailable: a.balance?.available ?? null,
      currency: a.balance?.currency ?? 'NZD',
      status: a.status,
      connectionLogo: a.connection.logo ?? null,
    };

    // Resolve to an existing row by stable identity.
    const match = existing.find((e) =>
      accountNumber ? e.accountNumber === accountNumber : e.akahuId === a._id
    );

    if (match) {
      await prisma.account.update({ where: { id: match.id }, data: fields });
    } else {
      await prisma.account.create({ data: { userId, ...fields } });
    }
  }

  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ count: accounts.length, accounts });
}
