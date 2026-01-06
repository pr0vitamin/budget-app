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
}

export function InboxPageClient({ transactions, unallocatedCount }: InboxPageClientProps) {
    const router = useRouter();
    const [showAddForm, setShowAddForm] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unallocated'>('all');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncTransactions = useCallback(async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/transactions/sync', { method: 'POST' });
            if (res.ok) {
                router.refresh();
            }
        } finally {
            setIsSyncing(false);
        }
    }, [router]);

    const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
        onRefresh: handleSyncTransactions,
        threshold: 80,
    });

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
        setSelectedTransaction(transaction);
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
                        onClick={handleSyncTransactions}
                        disabled={isSyncing || isRefreshing}
                        className="w-10 h-10 bg-white text-indigo-600 border border-indigo-200 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50"
                        title="Sync transactions from bank"
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
                />
            )}
        </div>
    );
}
