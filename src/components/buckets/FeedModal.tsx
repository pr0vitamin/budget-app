'use client';

import { useState, useEffect } from 'react';
import type { OverviewBucket, OverviewGroup } from '@/lib/api';

interface FeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeed: (bucketId: string, amount: number) => void;
  groups: OverviewGroup[];
  availableToBudget: number;
  /** Pre-select a specific bucket (optional) */
  initialBucketId?: string;
}

export function FeedModal({
  isOpen,
  onClose,
  onFeed,
  groups,
  availableToBudget,
  initialBucketId,
}: FeedModalProps) {
  const allBuckets: (OverviewBucket & { groupName: string })[] = groups.flatMap((g) =>
    g.buckets.map((b) => ({ ...b, groupName: g.name }))
  );

  const [selectedBucketId, setSelectedBucketId] = useState(initialBucketId ?? allBuckets[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBucket = allBuckets.find((b) => b.id === selectedBucketId);

  // Pre-fill amount with bucket's topUpAmount when selection changes
  useEffect(() => {
    if (selectedBucket && selectedBucket.topUpAmount > 0) {
      setAmount(selectedBucket.topUpAmount.toFixed(2));
    } else {
      setAmount('');
    }
    setError(null);
  }, [selectedBucketId, selectedBucket]);

  // Sync bucket selection when initialBucketId changes (e.g. modal re-opened)
  useEffect(() => {
    if (initialBucketId) setSelectedBucketId(initialBucketId);
  }, [initialBucketId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (numAmount > availableToBudget + 0.001) {
      setError(`Only $${availableToBudget.toFixed(2)} available to budget`);
      return;
    }
    if (!selectedBucketId) {
      setError('Please select a bucket');
      return;
    }

    setIsSubmitting(true);
    try {
      onFeed(selectedBucketId, numAmount);
      setAmount('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to feed cat');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
            style={{ backgroundColor: selectedBucket?.color ?? '#6366f1' }}
          >
            🍽️
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Custom Feed</h2>
            <p className="text-sm text-gray-500">
              Available: <span className="font-medium text-green-600">${availableToBudget.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
            <select
              value={selectedBucketId}
              onChange={(e) => setSelectedBucketId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {groups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || !selectedBucketId}
              className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Feeding...' : '🍽️ Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
