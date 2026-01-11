import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ensureUserExists } from '@/lib/ensure-user';
import { calculateAvailableToBudget } from '@/lib/calculate-available';
import { AppShell } from '@/components/layout';
import { BucketsPageClient } from './BucketsPageClient';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // Middleware will redirect
  }

  // Ensure user exists in Prisma database
  await ensureUserExists(user);

  // Fetch bucket groups with buckets
  const groups = await prisma.bucketGroup.findMany({
    where: { userId: user.id },
    include: {
      buckets: {
        where: { isDeleted: false },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const bucketIds = groups.flatMap(g => g.buckets.map(b => b.id));

  // Aggregate transaction allocations (expenses - negative)
  const transactionAllocations = await prisma.allocation.groupBy({
    by: ['bucketId'],
    where: { bucketId: { in: bucketIds } },
    _sum: { amount: true },
  });

  // Aggregate budget allocations (income feeds - positive)
  const budgetAllocations = await prisma.budgetAllocation.groupBy({
    by: ['bucketId'],
    where: { bucketId: { in: bucketIds } },
    _sum: { amount: true },
  });

  // Create lookup maps for fast access
  const transactionMap = new Map(transactionAllocations.map(a => [a.bucketId, Number(a._sum.amount || 0)]));
  const budgetMap = new Map(budgetAllocations.map(a => [a.bucketId, Number(a._sum.amount || 0)]));

  // Calculate balances
  const groupsWithBalances = groups.map((group) => ({
    id: group.id,
    name: group.name,
    buckets: group.buckets.map((bucket) => {
      const budgetAllocationTotal = budgetMap.get(bucket.id) || 0;
      const transactionAllocationTotal = transactionMap.get(bucket.id) || 0;
      const balance = budgetAllocationTotal + transactionAllocationTotal;

      return {
        id: bucket.id,
        name: bucket.name,
        type: bucket.type,
        color: bucket.color,
        balance,
        autoAllocationAmount: Number(bucket.autoAllocationAmount),
      };
    }),
  }));

  // Calculate total in buckets
  const totalInBuckets = groupsWithBalances.reduce(
    (sum, group) =>
      sum + group.buckets.reduce((bs, b) => bs + b.balance, 0),
    0
  );

  // Calculate available to budget (unallocated income)
  const availableToBudget = await calculateAvailableToBudget(user.id);

  return (
    <AppShell>
      <BucketsPageClient
        groups={groupsWithBalances}
        userEmail={user.email || ''}
        totalAvailable={totalInBuckets}
        availableToBudget={availableToBudget}
      />
    </AppShell>
  );
}
