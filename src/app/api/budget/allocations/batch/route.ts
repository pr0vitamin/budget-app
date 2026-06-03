import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

// Feeds every non-archived cat its topUpAmount — ALL-OR-NOTHING. If the pool
// can't cover every cat's full top-up, nothing is fed (returns { fed: [] }).
export async function POST() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [income, feeds, buckets] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.bucket.findMany({
      where: { group: { userId }, isArchived: false, topUpAmount: { gt: 0 } },
      orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    }),
  ]);

  const available = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });

  const total = buckets.reduce((s, b) => s + Number(b.topUpAmount), 0);

  // All-or-nothing: refuse to feed unless every cat can be fully fed.
  if (buckets.length === 0 || total > available + 0.001) {
    return NextResponse.json({ fed: [] });
  }

  await prisma.budgetAllocation.createMany({
    data: buckets.map((b) => ({ userId, bucketId: b.id, amount: Number(b.topUpAmount) })),
  });
  return NextResponse.json({ fed: buckets.map((b) => b.id) });
}
