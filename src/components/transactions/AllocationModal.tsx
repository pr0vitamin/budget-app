'use client';

import { useState, useEffect } from 'react';

interface Bucket {
    id: string;
    name: string;
    color: string;
    groupName: string;
}

interface AllocationRow {
    bucketId: string;
    amount: number;
}

interface AllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: {
        id: string;
        merchant: string;
        amount: number;
        date: string;
    };
    onAllocate: (
        transactionId: string,
        allocations: AllocationRow[],
        createRule: boolean
    ) => Promise<void>;
    availableToBudget?: number;
}

export function AllocationModal({
    isOpen,
    onClose,
    transaction,
    onAllocate,
    availableToBudget = 0,
}: AllocationModalProps) {
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [createRule, setCreateRule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch buckets on mount
    useEffect(() => {
        if (isOpen) {
            fetch('/api/bucket-groups')
                .then((res) => res.json())
                .then((groups) => {
                    const allBuckets: Bucket[] = [];
                    for (const group of groups) {
                        for (const bucket of group.buckets || []) {
                            allBuckets.push({
                                id: bucket.id,
                                name: bucket.name,
                                color: bucket.color,
                                groupName: group.name,
                            });
                        }
                    }
                    setBuckets(allBuckets);
                })
                .catch(console.error);
        }
    }, [isOpen]);

    // Reset state when modal opens with new transaction
    useEffect(() => {
        if (isOpen && transaction) {
            setAllocations([{ bucketId: '', amount: Math.abs(transaction.amount) }]);
            setSearchTerm('');
            setCreateRule(false);
            setError(null);
        }
    }, [isOpen, transaction]);

    const filteredBuckets = buckets.filter(
        (b) =>
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.groupName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleBucketSelect = (bucketId: string) => {
        // For simple single allocation, just set the bucket
        setAllocations([{ bucketId, amount: Math.abs(transaction.amount) }]);
    };

    const handleAddSplit = () => {
        setAllocations([...allocations, { bucketId: '', amount: 0 }]);
    };

    const handleRemoveSplit = (index: number) => {
        if (allocations.length > 1) {
            setAllocations(allocations.filter((_, i) => i !== index));
        }
    };

    const handleSplitAmountChange = (index: number, amount: number) => {
        const newAllocations = [...allocations];
        newAllocations[index].amount = amount;
        setAllocations(newAllocations);
    };

    const handleSplitBucketChange = (index: number, bucketId: string) => {
        const newAllocations = [...allocations];
        newAllocations[index].bucketId = bucketId;
        setAllocations(newAllocations);
    };

    const handleSubmit = async () => {
        // Validate
        const validAllocations = allocations.filter((a) => a.bucketId && a.amount !== 0);
        if (validAllocations.length === 0) {
            setError('Please select at least one bucket');
            return;
        }

        const sum = validAllocations.reduce((s, a) => s + a.amount, 0);
        const transAmount = Math.abs(transaction.amount);
        if (Math.abs(sum - transAmount) > 0.01) {
            setError(`Allocations must sum to $${transAmount.toFixed(2)} (currently $${sum.toFixed(2)})`);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // For expenses, amounts should be negative
            const finalAllocations = validAllocations.map((a) => ({
                bucketId: a.bucketId,
                amount: transaction.amount < 0 ? -Math.abs(a.amount) : Math.abs(a.amount),
            }));

            await onAllocate(transaction.id, finalAllocations, createRule);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to allocate');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isSplitMode = allocations.length > 1;
    const selectedBucket = allocations[0]?.bucketId
        ? buckets.find((b) => b.id === allocations[0].bucketId)
        : null;

    // Check if this is an expense that would exceed available budget
    const isExpense = transaction.amount < 0;
    const expenseAmount = Math.abs(transaction.amount);
    const wouldExceedBudget = isExpense && expenseAmount > availableToBudget && availableToBudget >= 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Allocate Transaction</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
                        ×
                    </button>
                </div>

                {/* Transaction summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="font-medium text-gray-800">{transaction.merchant}</p>
                    <p className="text-2xl font-bold text-gray-900">
                        ${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                        {new Date(transaction.date).toLocaleDateString('en-NZ', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        })}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Over-allocation warning */}
                {wouldExceedBudget && (
                    <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                            <span className="text-amber-500 text-lg">⚠️</span>
                            <div>
                                <p className="text-sm font-medium text-amber-800">
                                    This exceeds your available budget
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Available: ${availableToBudget.toFixed(2)} • This expense: ${expenseAmount.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Simple mode: Bucket selector */}
                {!isSplitMode && (
                    <>
                        <input
                            type="text"
                            placeholder="Search buckets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        <div className="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto">
                            {filteredBuckets.map((bucket) => (
                                <button
                                    key={bucket.id}
                                    onClick={() => handleBucketSelect(bucket.id)}
                                    className={`p-3 rounded-xl text-left transition-colors ${selectedBucket?.id === bucket.id
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    <div
                                        className="w-4 h-4 rounded-full mb-1"
                                        style={{ backgroundColor: bucket.color }}
                                    />
                                    <p className="font-medium text-sm truncate">{bucket.name}</p>
                                    <p
                                        className={`text-xs truncate ${selectedBucket?.id === bucket.id ? 'text-indigo-200' : 'text-gray-500'
                                            }`}
                                    >
                                        {bucket.groupName}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleAddSplit}
                            className="text-indigo-600 text-sm font-medium mb-4"
                        >
                            + Split between multiple buckets
                        </button>
                    </>
                )}

                {/* Split mode */}
                {isSplitMode && (
                    <div className="space-y-3 mb-4">
                        {allocations.map((alloc, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <select
                                    value={alloc.bucketId}
                                    onChange={(e) => handleSplitBucketChange(index, e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select bucket...</option>
                                    {buckets.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} ({b.groupName})
                                        </option>
                                    ))}
                                </select>
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        value={alloc.amount || ''}
                                        onChange={(e) => handleSplitAmountChange(index, parseFloat(e.target.value) || 0)}
                                        className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        step="0.01"
                                    />
                                </div>
                                {allocations.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveSplit(index)}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={handleAddSplit}
                            className="text-indigo-600 text-sm font-medium"
                        >
                            + Add another bucket
                        </button>
                    </div>
                )}

                {/* Create rule checkbox */}
                {transaction.merchant && (
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={createRule}
                            onChange={(e) => setCreateRule(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">
                            Always allocate "{transaction.merchant}" to this bucket
                        </span>
                    </label>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!selectedBucket && !isSplitMode)}
                        className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? 'Allocating...' : 'Allocate'}
                    </button>
                </div>
            </div>
        </div>
    );
}
