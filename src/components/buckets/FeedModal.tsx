'use client';

import { useState } from 'react';

interface FeedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFeed: (amount: number, note?: string) => Promise<void>;
    bucketName: string;
    bucketColor: string;
    availableToBudget: number;
}

export function FeedModal({
    isOpen,
    onClose,
    onFeed,
    bucketName,
    bucketColor,
    availableToBudget,
}: FeedModalProps) {
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (numAmount > availableToBudget) {
            setError(`Only $${availableToBudget.toFixed(2)} available to budget`);
            return;
        }

        setIsSubmitting(true);
        try {
            await onFeed(numAmount, note || undefined);
            setAmount('');
            setNote('');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to feed bucket');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                        style={{ backgroundColor: bucketColor }}
                    >
                        🍽️
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Feed {bucketName}</h2>
                        <p className="text-sm text-gray-500">
                            Available: <span className="font-medium text-green-600">${availableToBudget.toFixed(2)}</span>
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount
                        </label>
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Note (optional)
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g., Weekly groceries"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
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
                            disabled={isSubmitting || !amount}
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
