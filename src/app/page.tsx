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
        orderBy: { sortOrder: 'asc' },
        include: {
          allocations: true, // Transaction allocations (expenses)
          budgetAllocations: true, // Budget allocations (income feeding)
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Calculate balances (budget allocations + transaction allocations)
  const groupsWithBalances = groups.map((group) => ({
    id: group.id,
    name: group.name,
    buckets: group.buckets.map((bucket) => {
      // Budget allocations = money added from income pool (positive)
      const budgetAllocationTotal = bucket.budgetAllocations.reduce(
        (sum, ba) => sum + Number(ba.amount),
        0
      );
      // Transaction allocations = expenses (negative)
      const transactionAllocationTotal = bucket.allocations.reduce(
        (sum, alloc) => sum + Number(alloc.amount),
        0
      );
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
