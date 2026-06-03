'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Overview } from '@/lib/api';
import { qk } from './keys';

// Helper: optimistically patch the cached overview and return a rollback snapshot.
function usePatchOverview() {
  const qc = useQueryClient();
  return {
    qc,
    patch: async (mutate: (o: Overview) => Overview) => {
      await qc.cancelQueries({ queryKey: qk.overview });
      const prev = qc.getQueryData<Overview>(qk.overview);
      if (prev) qc.setQueryData<Overview>(qk.overview, mutate(structuredClone(prev)));
      return prev;
    },
  };
}

// Feed one bucket its given amount: bucket balance + amount, available − amount.
export function useFeedBucket() {
  const { qc, patch } = usePatchOverview();
  return useMutation({
    mutationFn: ({ bucketId, amount }: { bucketId: string; amount: number }) => api.feed(bucketId, amount),
    onMutate: ({ bucketId, amount }) =>
      patch((o) => {
        o.availableToBudget -= amount;
        for (const g of o.groups) for (const b of g.buckets) if (b.id === bucketId) b.balance += amount;
        return o;
      }).then((prev) => ({ prev })),
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.overview, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }),
  });
}

// Feed All is all-or-nothing: only feeds when the pool covers every cat's full
// top-up. The optimistic patch mirrors that — feed every cat with a top-up, or
// nothing. (The caller/button guards this too; the server enforces it as well.)
export function useFeedAll() {
  const { qc, patch } = usePatchOverview();
  return useMutation({
    mutationFn: () => api.feedAll(),
    onMutate: () =>
      patch((o) => {
        const cats = o.groups.flatMap((g) => g.buckets).filter((b) => b.topUpAmount > 0);
        const total = cats.reduce((s, b) => s + b.topUpAmount, 0);
        if (total === 0 || total > o.availableToBudget + 0.001) return o; // can't feed all → no-op
        for (const b of cats) b.balance += b.topUpAmount;
        o.availableToBudget -= total;
        return o;
      }).then((prev) => ({ prev })),
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.overview, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }),
  });
}

// Allocate (single or split). Optimistically clears the txn from the inbox and
// bumps bucket balances; refreshes overview + inbox on settle.
export function useAllocate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allocations }: { id: string; allocations: { bucketId: string; amount: number }[] }) =>
      api.allocate(id, allocations),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useReclassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string }) => api.reclassify(id, kind),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

// Generic invalidation mutations for CRUD where instant optimism is less critical.
export function useOverviewMutation<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }) });
}
