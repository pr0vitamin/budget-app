'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BudgetAllocation {
    id: string;
    amount: number;
    note: string | null;
    createdAt: string;
}

interface TransactionAllocation {
    id: string;
    transactionId: string;
    amount: number;
    merchant: string;
    date: string;
}

type AllocationItem =
    | { type: 'budget'; data: BudgetAllocation }
    | { type: 'transaction'; data: TransactionAllocation };

interface BucketDetailModalProps {
    bucketId: string;
    bucketName: string;
    bucketColor: string;
    isOpen: boolean;
    onClose: () => void;
    onEditBucket: () => void;
}

export function BucketDetailModal({
    bucketId,
    bucketName,
    bucketColor,
    isOpen,
    onClose,
    onEditBucket,
}: BucketDetailModalProps) {
    const router = useRouter();
    const [allocations, setAllocations] = useState<AllocationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editNote, setEditNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchAllocations();
        }
    }, [isOpen, bucketId]);

    const fetchAllocations = async (reset = true) => {
        if (reset) {
            setIsLoading(true);
            setAllocations([]);
        }
        try {
            const offset = reset ? 0 : allocations.length;
            const res = await fetch(`/api/buckets/${bucketId}?limit=50&offset=${offset}`);
            if (res.ok) {
                const data = await res.json();
                setHasMore(data.hasMore);

                // Combine and sort allocations by date
                const combined: AllocationItem[] = [
                    ...data.budgetAllocations.map((ba: BudgetAllocation) => ({
                        type: 'budget' as const,
                        data: ba,
                    })),
                    ...data.transactionAllocations.map((ta: TransactionAllocation) => ({
                        type: 'transaction' as const,
                        data: ta,
                    })),
                ];

                // Sort by date descending (most recent first)
                combined.sort((a, b) => {
                    const dateA = a.type === 'budget' ? a.data.createdAt : a.data.date;
                    const dateB = b.type === 'budget' ? b.data.createdAt : b.data.date;
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                });

                if (reset) {
                    setAllocations(combined);
                } else {
                    setAllocations(prev => [...prev, ...combined]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch allocations:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        setIsLoadingMore(true);
        fetchAllocations(false);
    };

    const handleDeleteBudgetAllocation = async (id: string) => {
        if (!confirm('Remove this allocation? The amount will be returned to Available to Budget.')) return;

        try {
            const res = await fetch(`/api/budget/allocations/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.refresh();
                fetchAllocations();
            }
        } catch (error) {
            console.error('Failed to delete budget allocation:', error);
        }
    };

    const handleDeleteTransactionAllocation = async (transactionId: string) => {
        if (!confirm('Unallocate this transaction from the cat?')) return;

        try {
            const res = await fetch(`/api/transactions/${transactionId}/allocations/${bucketId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.refresh();
                fetchAllocations();
            }
        } catch (error) {
            console.error('Failed to delete transaction allocation:', error);
        }
    };

    const startEdit = (allocation: BudgetAllocation) => {
        setEditingId(allocation.id);
        setEditAmount(allocation.amount.toString());
        setEditNote(allocation.note || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditAmount('');
        setEditNote('');
    };

    const handleEditBudgetAllocation = async (id: string) => {
        const amount = parseFloat(editAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            const res = await fetch(`/api/budget/allocations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, note: editNote || null }),
            });

            if (res.ok) {
                router.refresh();
                fetchAllocations();
                cancelEdit();
            }
        } catch (error) {
            console.error('Failed to edit budget allocation:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
                                style={{ backgroundColor: bucketColor }}
                            >
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">{bucketName}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={onEditBucket}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        ✏️ Edit Cat
                    </button>
                </div>

                {/* Activity List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity</h3>

                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : allocations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No activity yet</div>
                    ) : (
                        <div className="space-y-2">
                            {allocations.map((item, index) => {
                                if (item.type === 'budget') {
                                    const ba = item.data;
                                    const isEditing = editingId === ba.id;

                                    return (
                                        <div key={`budget-${ba.id}`} className="bg-green-50 rounded-lg p-4">
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl">💰</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={editAmount}
                                                            onChange={(e) => setEditAmount(e.target.value)}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                                            placeholder="Amount"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={editNote}
                                                        onChange={(e) => setEditNote(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                        placeholder="Note (optional)"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditBudgetAllocation(ba.id)}
                                                            className="px-3 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-2xl">💰</span>
                                                        <div>
                                                            <p className="font-semibold text-green-700">
                                                                +${ba.amount.toFixed(2)}
                                                            </p>
                                                            {ba.note && (
                                                                <p className="text-sm text-gray-600">{ba.note}</p>
                                                            )}
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {new Date(ba.createdAt).toLocaleDateString('en-NZ', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => startEdit(ba)}
                                                            className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-100 rounded"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBudgetAllocation(ba.id)}
                                                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-100 rounded"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                } else {
                                    const ta = item.data;
                                    return (
                                        <div key={`transaction-${ta.id}`} className="bg-red-50 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-gray-900">{ta.merchant}</p>
                                                    <p className="font-semibold text-red-600">
                                                        ${Math.abs(ta.amount).toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(ta.date).toLocaleDateString('en-NZ', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteTransactionAllocation(ta.transactionId)}
                                                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-100 rounded"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    )}

                    {/* Load More button */}
                    {hasMore && !isLoading && allocations.length > 0 && (
                        <div className="flex justify-center py-4">
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                {isLoadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
