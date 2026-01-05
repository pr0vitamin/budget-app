import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
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

  // Calculate total available
  const totalAvailable = groupsWithBalances.reduce(
    (sum, group) => sum + group.buckets.reduce((s, b) => s + b.balance, 0),
    0
  );

  return (
    <AppShell>
      <BucketsPageClient
        groups={groupsWithBalances}
        totalAvailable={totalAvailable}
        userEmail={user.email || ''}
      />
    </AppShell>
  );
}
