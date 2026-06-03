'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { TransactionList } from '@/components/transactions/TransactionList';
import { AllocationModal } from '@/components/transactions/AllocationModal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useTransactions, useOverview } from '@/lib/query/hooks';
import { useAllocate } from '@/lib/query/mutations';
import { api, type Transaction } from '@/lib/api';
import { qk } from '@/lib/query/keys';

export default function TransactionsPage() {
  const qc = useQueryClient();
  const { data: transactions, isLoading } = useTransactions();
  const { data: overview } = useOverview();
  const allocate = useAllocate();
  const [active, setActive] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
    qc.invalidateQueries({ queryKey: qk.transactions('all') });
    setActive(null);
  };

  const onEdit = async (id: string, data: { amount: number }) => {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    qc.invalidateQueries({ queryKey: qk.transactions('all') });
    qc.invalidateQueries({ queryKey: qk.overview });
  };

  const onDelete = async (id: string) => {
    await api.deleteTransaction(id);
    qc.invalidateQueries({ queryKey: qk.transactions('all') });
    qc.invalidateQueries({ queryKey: qk.overview });
  };

  const handleAddClose = () => {
    setAddOpen(false);
    qc.invalidateQueries({ queryKey: qk.transactions('all') });
    qc.invalidateQueries({ queryKey: qk.overview });
  };

  return (
    <AppShell>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Transactions</h1>
          <button
            onClick={() => setAddOpen(true)}
            className="text-sm text-indigo-600 font-medium px-3 py-1.5 rounded-xl bg-indigo-50 active:scale-95 transition-transform"
          >
            ＋ Add transaction
          </button>
        </div>

        {isLoading && !transactions ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <TransactionList
            transactions={transactions ?? []}
            onTransactionClick={setActive}
          />
        )}
      </div>

      {active && (
        <AllocationModal
          isOpen
          onClose={() => setActive(null)}
          buckets={buckets}
          transaction={active}
          onAllocate={onAllocate}
          onEdit={active.source === 'manual' ? onEdit : undefined}
          onDelete={active.source === 'manual' ? onDelete : undefined}
        />
      )}

      {addOpen && <TransactionForm onClose={handleAddClose} />}
    </AppShell>
  );
}
