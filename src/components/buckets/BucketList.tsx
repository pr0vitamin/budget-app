'use client';
import type { OverviewGroup } from '@/lib/api';
import { CatPiggyBank } from './CatPiggyBank';

export function BucketList({
  groups,
  onFeed,
  sparkleBucketIds,
}: {
  groups: OverviewGroup[];
  onFeed: (bucketId: string) => void;
  sparkleBucketIds: Set<string>;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">{group.name}</h2>
          <div className="grid grid-cols-3 gap-3">
            {group.buckets.map((b) => (
              <CatPiggyBank
                key={b.id}
                name={b.name}
                balance={b.balance}
                target={b.targetAmount ?? undefined}
                topUpAmount={b.topUpAmount}
                color={b.color}
                isOverspent={b.balance < 0}
                showSparkle={sparkleBucketIds.has(b.id)}
                onClick={() => onFeed(b.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
