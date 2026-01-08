'use client';

import { useState } from 'react';

interface CatAllocation {
    id: string;
    name: string;
    color: string;
    autoAllocationAmount: number;
    currentBalance: number;
}

interface FeedAllModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    cats: CatAllocation[];
    availableToBudget: number;
}

export function FeedAllModal({
    isOpen,
    onClose,
    onConfirm,
    cats,
    availableToBudget,
}: FeedAllModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    // Filter cats that have auto-allocation configured
    const catsToFeed = cats.filter(c => c.autoAllocationAmount > 0);
    const totalRequired = catsToFeed.reduce((sum, c) => sum + c.autoAllocationAmount, 0);
    const hasEnoughFunds = availableToBudget >= totalRequired;

    const handleConfirm = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to feed cats');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl">
                        🐱
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Feed all the cats!</h2>
                        <p className="text-sm text-gray-500">
                            Auto-allocate to {catsToFeed.length} cats
                        </p>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Available to Budget</span>
                        <span className={`font-bold ${availableToBudget >= totalRequired ? 'text-green-600' : 'text-gray-900'}`}>
                            ${availableToBudget.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Total Required</span>
                        <span className={`font-bold ${totalRequired > availableToBudget ? 'text-red-500' : 'text-gray-900'}`}>
                            ${totalRequired.toFixed(2)}
                        </span>
                    </div>
                    {hasEnoughFunds && (
                        <div className="flex justify-between border-t pt-2 mt-2">
                            <span className="text-gray-600">Remaining After</span>
                            <span className="font-bold text-gray-900">
                                ${(availableToBudget - totalRequired).toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Warning if insufficient funds */}
                {!hasEnoughFunds && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                        <span className="text-amber-500 text-lg">⚠️</span>
                        <p className="text-sm text-amber-700">
                            You don't have enough funds to feed all cats. You're short by{' '}
                            <strong>${(totalRequired - availableToBudget).toFixed(2)}</strong>.
                        </p>
                    </div>
                )}

                {/* Cat list */}
                <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-700">Cats to feed:</p>
                    {catsToFeed.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                            No cats have auto-allocation configured.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {catsToFeed.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-6 h-6 rounded-full"
                                            style={{ backgroundColor: cat.color }}
                                        />
                                        <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">
                                            {cat.name}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">
                                        +${cat.autoAllocationAmount.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting || catsToFeed.length === 0 || !hasEnoughFunds}
                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Feeding...' : '🍽️ Feed All!'}
                    </button>
                </div>
            </div>
        </div>
    );
}
