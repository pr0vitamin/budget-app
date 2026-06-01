import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

// One cache-first payload for the home screen: groups (with buckets + balances),
// the Available-to-Budget pool, and the inbox count.
export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.bucketGroup.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    include: { buckets: { where: { isArchived: false }, orderBy: { sortOrder: 'asc' } } },
  });

  const bucketIds = groups.flatMap((g) => g.buckets.map((b) => b.id));

  const [spendAgg, feedAgg, income, feedsTotal, inboxCount] = await Promise.all([
    prisma.allocation.groupBy({ by: ['bucketId'], where: { bucketId: { in: bucketIds } }, _sum: { amount: true } }),
    prisma.budgetAllocation.groupBy({ by: ['bucketId'], where: { bucketId: { in: bucketIds } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { userId, kind: 'expense', allocations: { none: {} } } }),
  ]);

  const spendMap = new Map(spendAgg.map((a) => [a.bucketId, Number(a._sum.amount ?? 0)]));
  const feedMap = new Map(feedAgg.map((a) => [a.bucketId, Number(a._sum.amount ?? 0)]));

  const groupsOut = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isCollapsed: g.isCollapsed,
    buckets: g.buckets.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      targetAmount: b.targetAmount === null ? null : Number(b.targetAmount),
      topUpAmount: Number(b.topUpAmount),
      balance: (feedMap.get(b.id) ?? 0) + (spendMap.get(b.id) ?? 0),
    })),
  }));

  const availableToBudget = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feedsTotal._sum.amount ?? 0),
  });

  return NextResponse.json({ groups: groupsOut, availableToBudget, inboxCount });
}
