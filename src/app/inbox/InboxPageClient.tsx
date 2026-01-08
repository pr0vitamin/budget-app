'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionList, TransactionForm, AllocationModal } from '@/components/transactions';
import { usePullToRefresh } from '@/hooks';

interface Transaction {
    id: string;
    amount: number;
    merchant: string;
    date: string;
    description?: string;
    isManual: boolean;
    isAmended?: boolean;
    allocations: Array<{
        bucket: { id: string; name: string; color: string };
        amount: number;
    }>;
}

interface InboxPageClientProps {
    transactions: Transaction[];
    unallocatedCount: number;
    hasMore?: boolean;
}

export function InboxPageClient({ transactions: initialTransactions, unallocatedCount, hasMore: initialHasMore = true }: InboxPageClientProps) {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unallocated'>('all');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncDays, setSyncDays] = useState(14);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // Check if this is a first-time sync (no transactions yet)
    const isFirstSync = transactions.length === 0;

    const handleSyncTransactions = useCallback(async (days?: number) => {
        setIsSyncing(true);
        setShowSyncModal(false);
        setSyncMessage(null);
        try {
            const res = await fetch('/api/transactions/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initialDays: days ?? 30 }),
            });
            const data = await res.json();

            if (data.onCooldown) {
                setSyncMessage(data.message);
            } else if (res.ok) {
                router.refresh();
            }
        } finally {
            setIsSyncing(false);
        }
    }, [router]);

    const handleSyncClick = useCallback(() => {
        if (isFirstSync) {
            // Show modal to configure days for first sync
            setShowSyncModal(true);
        } else {
            // Regular sync
            handleSyncTransactions();
        }
    }, [isFirstSync, handleSyncTransactions]);

    const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
        onRefresh: () => handleSyncTransactions(),
        threshold: 80,
    });

    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
            const res = await fetch(`/api/transactions?limit=50&offset=${transactions.length}`);
            const data = await res.json();

            if (data.length === 0) {
                setHasMore(false);
            } else {
                const formatted = data.map((t: { id: string; amount: number; merchant: string | null; date: string; description?: string | null; isManual: boolean; allocations: Array<{ bucket: { id: string; name: string; color: string }; amount: number }> }) => ({
                    id: t.id,
                    amount: Number(t.amount),
                    merchant: t.merchant || 'Unknown',
                    date: t.date,
                    description: t.description || undefined,
                    isManual: t.isManual,
                    allocations: t.allocations.map((a: { bucket: { id: string; name: string; color: string }; amount: number }) => ({
                        bucket: { id: a.bucket.id, name: a.bucket.name, color: a.bucket.color },
                        amount: Number(a.amount),
                    })),
                }));
                setTransactions(prev => [...prev, ...formatted]);
                if (data.length < 50) setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to load more:', err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, transactions.length]);

    const filteredTransactions =
        filter === 'unallocated'
            ? transactions.filter((t) => t.allocations.length === 0)
            : transactions;

    const handleAddTransaction = async (data: {
        amount: number;
        merchant: string;
        date: string;
        description?: string;
    }) => {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (res.ok) {
            setShowAddForm(false);
            router.refresh();
        }
    };

    const handleTransactionClick = (transaction: Transaction) => {
        // Only allow allocation for expenses (negative amounts)
        // Income (positive amounts) goes to the "Available to Budget" pool
        if (transaction.amount < 0) {
            setSelectedTransaction(transaction);
        }
    };

    const handleAllocate = async (
        transactionId: string,
        allocations: Array<{ bucketId: string; amount: number }>,
        createRule: boolean
    ) => {
        // Allocate transaction
        const allocRes = await fetch(`/api/transactions/${transactionId}/allocate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allocations }),
        });

        if (!allocRes.ok) {
            const error = await allocRes.json();
            throw new Error(error.error || 'Failed to allocate');
        }

        // Create rule if requested
        if (createRule && selectedTransaction?.merchant && allocations.length === 1) {
            await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantPattern: selectedTransaction.merchant,
                    bucketId: allocations[0].bucketId,
                }),
            });
        }

        setSelectedTransaction(null);
        router.refresh();
    };

    const handleEditTransaction = async (transactionId: string, data: { amount: number }) => {
        const res = await fetch(`/api/transactions/${transactionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to update');
        }

        router.refresh();
    };

    const handleDeleteTransaction = async (transactionId: string) => {
        const res = await fetch(`/api/transactions/${transactionId}`, {
            method: 'DELETE',
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to delete');
        }

        router.refresh();
    };

    return (
        <div className="p-4 h-full overflow-auto" {...handlers}>
            {/* Pull to refresh indicator */}
            <div
                className="flex justify-center overflow-hidden transition-all"
                style={{ height: pullDistance > 0 ? pullDistance : 0 }}
            >
                <div className="flex items-center gap-2 text-gray-500">
                    {isRefreshing ? (
                        <>
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Syncing...
                        </>
                    ) : pullDistance > 60 ? (
                        'Release to refresh'
                    ) : (
                        'Pull to refresh'
                    )}
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                <div className="flex items-center gap-2">
                    {/* Sync button */}
                    <button
                        onClick={handleSyncClick}
                        disabled={isSyncing || isRefreshing}
                        className="w-10 h-10 bg-white text-indigo-600 border border-indigo-200 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50"
                        title={isFirstSync ? 'Set up transaction sync' : 'Sync transactions from bank'}
                    >
                        {isSyncing || isRefreshing ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                    </button>
                    {/* Add button */}
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Sync cooldown message */}
            {syncMessage && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-700 text-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {syncMessage}
                    </div>
                    <button
                        onClick={() => setSyncMessage(null)}
                        className="text-amber-500 hover:text-amber-700"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'all'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    All ({transactions.length})
                </button>
                <button
                    onClick={() => setFilter('unallocated')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'unallocated'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    Needs Review ({unallocatedCount})
                </button>
            </div>

            {/* Transaction list */}
            <TransactionList
                transactions={filteredTransactions}
                onTransactionClick={handleTransactionClick}
            />

            {/* Load More button */}
            {hasMore && filter === 'all' && (
                <div className="flex justify-center py-4">
                    <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {isLoadingMore ? (
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Loading...
                            </span>
                        ) : (
                            'Load More'
                        )}
                    </button>
                </div>
            )}

            {/* Add transaction form modal */}
            {showAddForm && (
                <TransactionForm onSubmit={handleAddTransaction} onCancel={() => setShowAddForm(false)} />
            )}

            {/* Allocation modal */}
            {selectedTransaction && (
                <AllocationModal
                    isOpen={!!selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                    transaction={selectedTransaction}
                    onAllocate={handleAllocate}
                    onEdit={handleEditTransaction}
                    onDelete={handleDeleteTransaction}
                />
            )}

            {/* First sync modal */}
            {showSyncModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Sync Transactions</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            How many days of transaction history would you like to import?
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {syncDays} days
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="30"
                                value={syncDays}
                                onChange={(e) => setSyncDays(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>1 day</span>
                                <span>30 days</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSyncModal(false)}
                                className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSyncTransactions(syncDays)}
                                className="flex-1 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                            >
                                Sync
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
