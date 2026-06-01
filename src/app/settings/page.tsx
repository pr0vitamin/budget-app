'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { BucketForm } from '@/components/buckets/BucketForm';
import { BucketDetailModal } from '@/components/buckets/BucketDetailModal';
import { ReorderGroupsModal } from '@/components/buckets/ReorderGroupsModal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useSettings, useOverview } from '@/lib/query/hooks';
import { useOverviewMutation } from '@/lib/query/mutations';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { signOut } from '@/app/login/actions';

type Modal =
  | { kind: 'newBucket'; groupId: string }
  | { kind: 'editBucket'; bucketId: string; groupId: string }
  | { kind: 'bucketDetail'; bucketId: string; bucketName: string; bucketColor: string }
  | { kind: 'reorder' }
  | { kind: 'newGroup' }
  | { kind: 'newTransaction' };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: overview } = useOverview();
  const [syncDays, setSyncDays] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Use local state if user has changed, otherwise fall back to server data
  const currentSyncDays = syncDays ?? settings?.initialSyncDays ?? 30;
  const currentTheme = theme ?? settings?.theme ?? 'system';
  const isDirty = syncDays !== null || theme !== null;

  const createBucketMutation = useOverviewMutation(
    ({ groupId, data }: { groupId: string; data: Parameters<typeof api.createBucket>[0] }) =>
      api.createBucket({ ...data, groupId })
  );
  const updateBucketMutation = useOverviewMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateBucket(id, data)
  );
  const deleteBucketMutation = useOverviewMutation((id: string) => api.deleteBucket(id));
  const reorderGroupsMutation = useOverviewMutation((order: string[]) => api.reorderGroups(order));
  const createGroupMutation = useOverviewMutation((name: string) => api.createGroup(name));

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings({
        initialSyncDays: currentSyncDays,
        theme: currentTheme,
      });
      qc.invalidateQueries({ queryKey: qk.settings });
      setSyncDays(null);
      setTheme(null);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
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

  const groups = overview?.groups ?? [];

  return (
    <AppShell>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button onClick={() => signOut()} className="text-red-500 font-medium">
            Sign Out
          </button>
        </div>

        {settingsLoading && !settings ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Sync settings */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Sync</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial sync days (1–30)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={currentSyncDays}
                  onChange={(e) =>
                    setSyncDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days back to fetch transactions on first sync
                </p>
              </div>
            </div>

            {/* Theme settings */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Appearance
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        currentTheme === t
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save settings button */}
            {isDirty && (
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 mb-4"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            )}

            {/* Bucket groups management */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                  Clowders (Groups)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ kind: 'reorder' })}
                    className="text-xs text-indigo-600 font-medium"
                  >
                    Reorder
                  </button>
                  <button
                    onClick={() => setModal({ kind: 'newGroup' })}
                    className="text-xs text-indigo-600 font-medium"
                  >
                    + Group
                  </button>
                </div>
              </div>

              {groups.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No groups yet. Create one to get started.</p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{group.name}</span>
                        <button
                          onClick={() => setModal({ kind: 'newBucket', groupId: group.id })}
                          className="text-xs text-indigo-600 font-medium"
                        >
                          + Cat
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
                                })
                              }
                              className="w-full flex items-center gap-2 text-left py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div
                                className="w-6 h-6 rounded-full flex-shrink-0"
                                style={{ backgroundColor: bucket.color }}
                              />
                              <span className="text-sm text-gray-700 flex-1">{bucket.name}</span>
                              <span className="text-xs text-gray-400">
                                ${bucket.balance.toFixed(2)}
                              </span>
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

            {/* Manual transaction entry */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                  Transactions
                </h2>
                <button
                  onClick={() => setModal({ kind: 'newTransaction' })}
                  className="text-xs text-indigo-600 font-medium"
                >
                  + Add Manual
                </button>
              </div>
            </div>

            {/* Bank accounts placeholder */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Bank accounts (coming in sync phase)
              </h2>
              <p className="text-sm text-gray-500">
                Bank account management will be available after the Akahu sync phase.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
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
          onSubmit={async (data) => {
            await createBucketMutation.mutateAsync({
              groupId: modal.groupId,
              data: {
                groupId: modal.groupId,
                name: data.name,
                color: data.color,
                icon: data.icon,
                topUpAmount: data.topUpAmount,
                targetAmount: data.targetAmount ?? null,
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
            const b = groups
              .flatMap((g) => g.buckets)
              .find((b) => b.id === modal.bucketId);
            return b
              ? { name: b.name, color: b.color, topUpAmount: b.topUpAmount, targetAmount: b.targetAmount }
              : undefined;
          })()}
          onSubmit={async (data) => {
            await updateBucketMutation.mutateAsync({
              id: modal.bucketId,
              data: {
                name: data.name,
                color: data.color,
                icon: data.icon,
                topUpAmount: data.topUpAmount,
                targetAmount: data.targetAmount ?? null,
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

      {modal?.kind === 'newTransaction' && (
        <TransactionForm onClose={() => setModal(null)} />
      )}
    </AppShell>
  );
}
