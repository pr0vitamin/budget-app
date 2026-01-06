'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionList, TransactionForm, AllocationModal } from '@/components/transactions';

interface Transaction {
    id: string;
    amount: number;
    merchant: string;
    date: string;
    description?: string;
    isManual: boolean;
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
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
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
