'use client';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout';
import { BucketForm } from '@/components/buckets/BucketForm';
import { BucketDetailModal } from '@/components/buckets/BucketDetailModal';
import { ReorderGroupsModal } from '@/components/buckets/ReorderGroupsModal';
import { FeedModal } from '@/components/buckets/FeedModal';
import { ConfettiCelebration } from '@/components/animations';
import { Skeleton } from '@/components/ui';
import { useOverview } from '@/lib/query/hooks';
import { useFeedBucket, useFeedAll, useOverviewMutation } from '@/lib/query/mutations';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { showToast } from '@/lib/toast';
import { CatPiggyBank } from '@/components/buckets/CatPiggyBank';

type Modal =
  | { kind: 'newBucket'; groupId: string }
  | { kind: 'editBucket'; bucketId: string; groupId: string }
  | { kind: 'bucketDetail'; bucketId: string; bucketName: string; bucketColor: string; bucketBalance: number }
  | { kind: 'reorder' }
  | { kind: 'newGroup' };

export default function HomePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useOverview();
  const feed = useFeedBucket();
  const feedAll = useFeedAll();

  const lastSyncAt = data?.lastSyncAt ?? null;
  const cooldownMsLeft = useMemo(
    () => (lastSyncAt ? Math.max(0, new Date(lastSyncAt).getTime() + 3600_000 - Date.now()) : 0),
    [lastSyncAt]
  );

  const onRefresh = async () => {
    if (cooldownMsLeft > 0) return;
    try {
      const r = await api.sync();
      if (!r.cooldown) {
        const n = (r.created ?? 0) + (r.updated ?? 0) + (r.confirmed ?? 0);
        showToast(
          n > 0
            ? `Synced — ${n} update${n === 1 ? '' : 's'}${r.flaggedReview ? `, ${r.flaggedReview} to review` : ''}`
            : 'Up to date',
          'success'
        );
      }
    } catch {
      showToast('Sync failed — pull down to try again', 'error');
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.overview }),
      qc.invalidateQueries({ queryKey: qk.transactions('all') }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
    ]);
  };
  const { isRefreshing, pullDistance, handlers } = usePullToRefresh({ onRefresh });
  const [sparkles, setSparkles] = useState<Set<string>>(new Set());
  const [confetti, setConfetti] = useState(false);
  const [feedBucketId, setFeedBucketId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const createBucketMutation = useOverviewMutation(
    ({ groupId, data: d }: { groupId: string; data: Parameters<typeof api.createBucket>[0] }) =>
      api.createBucket({ ...d, groupId })
  );
  const updateBucketMutation = useOverviewMutation(
    ({ id, data: d }: { id: string; data: Record<string, unknown> }) => api.updateBucket(id, d)
  );
  const deleteBucketMutation = useOverviewMutation((id: string) => api.deleteBucket(id));
  const reorderGroupsMutation = useOverviewMutation((order: string[]) => api.reorderGroups(order));
  const createGroupMutation = useOverviewMutation((name: string) => api.createGroup(name));

  const sparkle = (ids: string[]) => {
    setSparkles(new Set(ids));
    setTimeout(() => setSparkles(new Set()), 900);
  };

  // Feed All is all-or-nothing: only enabled when the pool covers every cat's top-up.
  const feedAllCats = (data?.groups ?? []).flatMap((g) => g.buckets).filter((b) => b.topUpAmount > 0);
  const feedAllTotal = feedAllCats.reduce((s, b) => s + b.topUpAmount, 0);
  const canFeedAll = feedAllCats.length > 0 && feedAllTotal <= (data?.availableToBudget ?? 0) + 0.001;

  const onFeedAll = () => {
    if (!data || !canFeedAll) return;
    sparkle(feedAllCats.map((b) => b.id));
    feedAll.mutate();
    if (data.availableToBudget - feedAllTotal <= 0.001) setConfetti(true);
  };

  const onCustomFeed = (bucketId: string, amount: number) => {
    sparkle([bucketId]);
    feed.mutate({ bucketId, amount });
    if ((data?.availableToBudget ?? 0) - amount <= 0.001) setConfetti(true);
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setIsCreatingGroup(true);
    try {
      await createGroupMutation.mutateAsync(name);
      setNewGroupName('');
      setModal(null);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const groups = data?.groups ?? [];

  return (
    <AppShell>
      <div className="p-4" {...handlers}>
        {isRefreshing && (
          <div className="flex justify-center py-2 text-indigo-500 text-sm">Refreshing...</div>
        )}
        {pullDistance > 0 && !isRefreshing && (
          <div className="flex justify-center py-1 text-gray-400 text-xs" style={{ height: pullDistance }}>
            {cooldownMsLeft > 0 ? `Next sync in ${Math.ceil(cooldownMsLeft / 60000)}m` : 'Pull to refresh'}
          </div>
        )}
        {/* Header: Available to Budget card */}
        <div className="mb-4 rounded-2xl bg-indigo-500 p-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm opacity-90">Available to Budget</p>
            <button
              onClick={() => setManageMode((m) => !m)}
              className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                manageMode
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/20 text-white backdrop-blur'
              }`}
            >
              {manageMode ? 'Done' : '✏️ Manage'}
            </button>
          </div>
          <p className="text-3xl font-bold">${(data?.availableToBudget ?? 0).toFixed(2)}</p>
          {!manageMode && (
            <div className="mt-3">
              <button
                onClick={onFeedAll}
                disabled={!canFeedAll}
                className="w-full rounded-xl bg-white/20 py-2 font-medium backdrop-blur active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                🐱 Feed All
              </button>
              {feedAllCats.length > 0 && !canFeedAll && (
                <p className="mt-1 text-center text-xs text-white/80">
                  Need ${feedAllTotal.toFixed(2)} to feed all cats
                </p>
              )}
            </div>
          )}
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : manageMode ? (
          /* ── Manage Mode ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Clowders & Cats</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setModal({ kind: 'reorder' })}
                  className="text-xs text-indigo-600 font-medium px-2 py-1 rounded-lg bg-indigo-50"
                >
                  Reorder
                </button>
                <button
                  onClick={() => setModal({ kind: 'newGroup' })}
                  className="text-xs text-indigo-600 font-medium px-2 py-1 rounded-lg bg-indigo-50"
                >
                  ＋ New Clowder
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No clowders yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="border border-gray-100 rounded-2xl p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-800">{group.name}</span>
                      <button
                        onClick={() => setModal({ kind: 'newBucket', groupId: group.id })}
                        className="text-xs text-indigo-600 font-medium px-2 py-1 rounded-lg bg-indigo-50"
                      >
                        ＋ Cat
                      </button>
                    </div>
                    {group.buckets.length > 0 ? (
                      <div className="space-y-1">
                        {group.buckets.map((bucket) => (
                          <button
                            key={bucket.id}
                            onClick={() =>
                              setModal({
                                kind: 'bucketDetail',
                                bucketId: bucket.id,
                                bucketName: bucket.name,
                                bucketColor: bucket.color,
                                bucketBalance: bucket.balance,
                              })
                            }
                            className="w-full flex items-center gap-2 text-left py-1.5 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              style={{ backgroundColor: bucket.color }}
                            />
                            <span className="text-sm text-gray-700 flex-1">{bucket.name}</span>
                            <span className="text-xs text-gray-400">${bucket.balance.toFixed(2)}</span>
                            <span className="text-xs text-indigo-400">Edit →</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 pl-2">No cats yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Feed Mode ── */
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.id}>
                <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">{group.name}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {group.buckets.map((b) => (
                    <div key={b.id} className="flex flex-col items-center gap-1">
                      <CatPiggyBank
                        name={b.name}
                        balance={b.balance}
                        target={b.targetAmount ?? undefined}
                        topUpAmount={b.topUpAmount}
                        color={b.color}
                        isOverspent={b.balance < 0}
                        showSparkle={sparkles.has(b.id)}
                        onClick={() =>
                          setModal({
                            kind: 'bucketDetail',
                            bucketId: b.id,
                            bucketName: b.name,
                            bucketColor: b.color,
                            bucketBalance: b.balance,
                          })
                        }
                      />
                      <button
                        onClick={() => setFeedBucketId(b.id)}
                        disabled={(data?.availableToBudget ?? 0) <= 0.001}
                        className="text-xs font-medium px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-600 disabled:opacity-40 active:scale-95 transition-transform"
                      >
                        🍽️ Feed
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <ConfettiCelebration trigger={confetti} onComplete={() => setConfetti(false)} />

      {data && feedBucketId && (
        <FeedModal
          key={feedBucketId}
          isOpen
          onClose={() => setFeedBucketId(null)}
          onFeed={onCustomFeed}
          groups={data.groups}
          availableToBudget={data.availableToBudget}
          initialBucketId={feedBucketId}
        />
      )}

      {/* Manage-mode modals */}
      {modal?.kind === 'newGroup' && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">New Clowder</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g., Bills, Fun, Savings"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl disabled:opacity-50"
              >
                {isCreatingGroup ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.kind === 'newBucket' && (
        <BucketForm
          groupId={modal.groupId}
          onSubmit={async (d) => {
            await createBucketMutation.mutateAsync({
              groupId: modal.groupId,
              data: {
                groupId: modal.groupId,
                name: d.name,
                color: d.color,
                icon: d.icon,
                topUpAmount: d.topUpAmount,
                targetAmount: d.targetAmount ?? null,
              },
            });
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.kind === 'editBucket' && (
        <BucketForm
          groupId={modal.groupId}
          bucketId={modal.bucketId}
          initialData={(() => {
            const b = groups.flatMap((g) => g.buckets).find((b) => b.id === modal.bucketId);
            return b
              ? { name: b.name, color: b.color, topUpAmount: b.topUpAmount, targetAmount: b.targetAmount }
              : undefined;
          })()}
          onSubmit={async (d) => {
            await updateBucketMutation.mutateAsync({
              id: modal.bucketId,
              data: {
                name: d.name,
                color: d.color,
                icon: d.icon,
                topUpAmount: d.topUpAmount,
                targetAmount: d.targetAmount ?? null,
              },
            });
            setModal(null);
          }}
          onCancel={() => setModal(null)}
          onDelete={async () => {
            if (!confirm('Delete this cat? This cannot be undone.')) return;
            await deleteBucketMutation.mutateAsync(modal.bucketId);
            setModal(null);
          }}
        />
      )}

      {modal?.kind === 'bucketDetail' && (
        <BucketDetailModal
          bucketId={modal.bucketId}
          bucketName={modal.bucketName}
          bucketColor={modal.bucketColor}
          balance={modal.bucketBalance}
          isOpen
          onClose={() => setModal(null)}
          onEditBucket={() => {
            const group = groups.find((g) => g.buckets.some((b) => b.id === modal.bucketId));
            if (group) {
              setModal({
                kind: 'editBucket',
                bucketId: modal.bucketId,
                groupId: group.id,
              });
            }
          }}
        />
      )}

      {modal?.kind === 'reorder' && (
        <ReorderGroupsModal
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          onSave={async (order) => {
            await reorderGroupsMutation.mutateAsync(order);
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </AppShell>
  );
}
