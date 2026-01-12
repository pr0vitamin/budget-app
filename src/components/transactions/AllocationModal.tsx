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
        isManual?: boolean;
        allocations?: Array<{
            bucket: { id: string; name: string; color: string };
            amount: number;
        }>;
    };
    onAllocate: (
        transactionId: string,
        allocations: AllocationRow[],
        createRule: boolean
    ) => Promise<void>;
    onEdit?: (transactionId: string, data: { amount: number }) => Promise<void>;
    onDelete?: (transactionId: string) => Promise<void>;

}

export function AllocationModal({
    isOpen,
    onClose,
    transaction,
    onAllocate,
    onEdit,
    onDelete,
}: AllocationModalProps) {
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [createRule, setCreateRule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedAmount, setEditedAmount] = useState('');

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
            setIsEditing(false);
            setEditedAmount(Math.abs(transaction.amount).toFixed(2));
        }
    }, [isOpen, transaction]);

    const handleSaveEdit = async () => {
        if (!onEdit) return;
        const newAmount = parseFloat(editedAmount);
        if (isNaN(newAmount) || newAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        setIsSubmitting(true);
        try {
            // Invert if original was negative (expense)
            const finalAmount = transaction.amount < 0 ? -newAmount : newAmount;
            await onEdit(transaction.id, { amount: finalAmount });
            setIsEditing(false);
            onClose();
        } catch {
            setError('Failed to update transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!confirm('Delete this transaction? This cannot be undone.')) return;
        setIsSubmitting(true);
        try {
            await onDelete(transaction.id);
            onClose();
        } catch {
            setError('Failed to delete transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

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
            setError('Please select at least one cat');
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

    const isIncome = transaction.amount >= 0;
    const isSplitMode = allocations.length > 1;
    const selectedBucket = allocations[0]?.bucketId
        ? buckets.find((b) => b.id === allocations[0].bucketId)
        : null;



    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isIncome ? 'Transaction Details' : 'Allocate Transaction'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
                        ×
                    </button>
                </div>

                {/* Transaction summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="font-medium text-gray-800">{transaction.merchant}</p>

                    {isEditing ? (
                        <div className="mt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-gray-900">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={editedAmount}
                                    onChange={(e) => setEditedAmount(e.target.value)}
                                    className="text-xl font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSubmitting}
                                    className="px-3 py-1 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
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

                            {/* Edit/Delete buttons for manual transactions */}
                            {transaction.isManual && (onEdit || onDelete) && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                    {onEdit && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1"
                                        >
                                            ✏️ Edit Amount
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={handleDelete}
                                            disabled={isSubmitting}
                                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                                        >
                                            🗑️ Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Income explanation */}
                {isIncome && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                        <p className="text-sm font-medium text-green-800 mb-1">💰 Income Transaction</p>
                        <p className="text-xs text-green-700">
                            Income is automatically added to your "Available to Budget" pool. No allocation needed.
                        </p>
                    </div>
                )}

                {/* Current allocation display */}
                {!isIncome && transaction.allocations && transaction.allocations.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                        <p className="text-sm font-medium text-green-800 mb-2">✓ Currently allocated to:</p>
                        <div className="space-y-2">
                            {transaction.allocations.map((alloc, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: alloc.bucket.color }}
                                        />
                                        <span className="font-medium text-green-800">{alloc.bucket.name}</span>
                                    </div>
                                    <span className="text-green-700 font-medium">
                                        ${Math.abs(alloc.amount).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-green-600 mt-2">Select a different cat below to change the allocation</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}



                {/* Simple mode: Bucket selector */}
                {!isIncome && !isSplitMode && (
                    <>
                        <input
                            type="text"
                            placeholder="Search cats..."
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
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
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
                            + Split between multiple cats
                        </button>
                    </>
                )}

                {/* Split mode */}
                {!isIncome && isSplitMode && (
                    <div className="space-y-3 mb-4">
                        {allocations.map((alloc, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <select
                                    value={alloc.bucketId}
                                    onChange={(e) => handleSplitBucketChange(index, e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select cat...</option>
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
                            + Add another cat
                        </button>
                    </div>
                )}

                {/* Create rule checkbox */}
                {!isIncome && transaction.merchant && (
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={createRule}
                            onChange={(e) => setCreateRule(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">
                            Always allocate "{transaction.merchant}" to this cat
                        </span>
                    </label>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        {isIncome ? 'Close' : 'Cancel'}
                    </button>
                    {!isIncome && (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || (!selectedBucket && !isSplitMode)}
                            className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Allocating...' : 'Allocate'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
