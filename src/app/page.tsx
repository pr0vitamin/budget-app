'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { BucketList } from '@/components/buckets/BucketList';
import { ConfettiCelebration } from '@/components/animations';
import { Skeleton } from '@/components/ui';
import { useOverview } from '@/lib/query/hooks';
import { useFeedBucket, useFeedAll } from '@/lib/query/mutations';

export default function HomePage() {
  const { data, isLoading } = useOverview();
  const feed = useFeedBucket();
  const feedAll = useFeedAll();
  const [sparkles, setSparkles] = useState<Set<string>>(new Set());
  const [confetti, setConfetti] = useState(false);

  const sparkle = (ids: string[]) => {
    setSparkles(new Set(ids));
    setTimeout(() => setSparkles(new Set()), 900);
  };

  // Instant: animate from cached topUp/available BEFORE the network resolves.
  const onFeed = (bucketId: string) => {
    const bucket = data?.groups.flatMap((g) => g.buckets).find((b) => b.id === bucketId);
    if (!bucket || bucket.topUpAmount <= 0) return;
    if (bucket.topUpAmount > (data?.availableToBudget ?? 0) + 0.001) return; // can't overdraw the pool
    sparkle([bucketId]);
    feed.mutate({ bucketId, amount: bucket.topUpAmount });
    if ((data?.availableToBudget ?? 0) - bucket.topUpAmount <= 0.001) setConfetti(true);
  };

  const onFeedAll = () => {
    if (!data) return;
    let avail = data.availableToBudget;
    const fed: string[] = [];
    for (const g of data.groups)
      for (const b of g.buckets)
        if (b.topUpAmount > 0 && b.topUpAmount <= avail + 0.001) { fed.push(b.id); avail -= b.topUpAmount; }
    if (fed.length === 0) return;
    sparkle(fed);
    feedAll.mutate();
    if (avail <= 0.001) setConfetti(true);
  };

  return (
    <AppShell>
      <div className="p-4">
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 p-5 text-white">
          <p className="text-sm opacity-90">Available to Budget</p>
          <p className="text-3xl font-bold">${(data?.availableToBudget ?? 0).toFixed(2)}</p>
          <button
            onClick={onFeedAll}
            className="mt-3 w-full rounded-xl bg-white/20 py-2 font-medium backdrop-blur active:scale-95 transition-transform"
          >
            🐱 Feed All
          </button>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : (
          <BucketList groups={data?.groups ?? []} onFeed={onFeed} sparkleBucketIds={sparkles} />
        )}
      </div>
      <ConfettiCelebration trigger={confetti} onComplete={() => setConfetti(false)} />
    </AppShell>
  );
}
