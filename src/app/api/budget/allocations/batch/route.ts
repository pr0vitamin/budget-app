import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

// Feeds every non-archived bucket its topUpAmount, capped at what's available.
// Buckets are processed in sortOrder; once available runs out, the rest are skipped.
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

  let available = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });

  const toCreate: { userId: string; bucketId: string; amount: number }[] = [];
  for (const bucket of buckets) {
    const topUp = Number(bucket.topUpAmount);
    if (topUp <= available + 0.001) {
      toCreate.push({ userId, bucketId: bucket.id, amount: topUp });
      available -= topUp;
    }
  }

  if (toCreate.length > 0) {
    await prisma.budgetAllocation.createMany({ data: toCreate });
  }
  return NextResponse.json({ fed: toCreate.map((c) => c.bucketId) });
}
