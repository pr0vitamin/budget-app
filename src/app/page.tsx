import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ensureUserExists } from '@/lib/ensure-user';
import { calculateAvailableToBudget, getUnallocatedCount } from '@/lib/calculate-available';
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
          allocations: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Calculate balances
  const groupsWithBalances = groups.map((group) => ({
    id: group.id,
    name: group.name,
    buckets: group.buckets.map((bucket) => {
      const balance = bucket.allocations.reduce(
        (sum, alloc) => sum + Number(alloc.amount),
        0
      );
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
  const unallocatedCount = await getUnallocatedCount(user.id);

  return (
    <AppShell inboxBadgeCount={unallocatedCount}>
      <BucketsPageClient
        groups={groupsWithBalances}
        userEmail={user.email || ''}
        totalAvailable={totalInBuckets}
        availableToBudget={availableToBudget}
      />
    </AppShell>
  );
}
