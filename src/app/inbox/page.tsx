'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { AllocationModal } from '@/components/transactions';
import { useInbox, useOverview } from '@/lib/query/hooks';
import { useAllocate } from '@/lib/query/mutations';
import { api, type Transaction } from '@/lib/api';

export default function InboxPage() {
  const { data: inbox, isLoading } = useInbox();
  const { data: overview } = useOverview();
  const allocate = useAllocate();
  const [active, setActive] = useState<Transaction | null>(null);

  const buckets = (overview?.groups ?? []).flatMap((g) =>
    g.buckets.map((b) => ({ id: b.id, name: b.name, color: b.color, groupName: g.name }))
  );

  const onAllocate = async (
    id: string,
    allocations: { bucketId: string; amount: number }[],
    createRule: boolean,
    merchant: string | null
  ) => {
    await allocate.mutateAsync({ id, allocations });
    if (createRule && merchant && allocations.length === 1) {
      await api.createRule(merchant, allocations[0].bucketId).catch(() => {});
    }
    setActive(null);
  };

  return (
    <AppShell>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Inbox</h1>
        {isLoading && !inbox ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : inbox && inbox.length > 0 ? (
          <ul className="space-y-2">
            {inbox.map((t) => (
              <li key={t.id}>
                <button onClick={() => setActive(t)} className="w-full text-left rounded-xl bg-white border border-gray-200 p-3 flex justify-between">
                  <span>
                    <span className="font-medium">{t.merchant ?? t.description ?? 'Transaction'}</span>
                    {t.status === 'pending' && <span className="ml-2 text-xs text-amber-600">pending</span>}
                    {t.needsReview && <span className="ml-2 text-xs text-red-600">review</span>}
                  </span>
                  <span className="font-semibold">${Math.abs(t.amount).toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-400 py-12">All caught up 🎉</p>
        )}
      </div>
      {active && (
        <AllocationModal
          isOpen
          onClose={() => setActive(null)}
          buckets={buckets}
          transaction={active}
          onAllocate={onAllocate}
        />
      )}
    </AppShell>
  );
}
