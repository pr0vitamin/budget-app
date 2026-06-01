'use client';

import type { Transaction } from '@/lib/api';

interface TransactionListProps {
    transactions: Transaction[];
    onTransactionClick?: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onTransactionClick }: TransactionListProps) {
    if (transactions.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">📬</div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">All caught up!</h2>
                <p className="text-gray-500">
                    No transactions to review. Add one manually or connect your bank.
                </p>
            </div>
        );
    }

    // Group transactions by date
    const grouped = transactions.reduce(
        (acc, t) => {
            const dateKey = new Date(t.date).toLocaleDateString('en-NZ', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
            });
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(t);
            return acc;
        },
        {} as Record<string, Transaction[]>
    );

    return (
        <div className="space-y-4">
            {Object.entries(grouped).map(([dateLabel, dayTransactions]) => (
                <div key={dateLabel}>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">{dateLabel}</h3>
                    <div className="space-y-2">
                        {dayTransactions.map((t) => {
                            const isIncome = t.amount > 0;
                            const isAllocated = t.allocations.length > 0;
                            const isPending = t.status === 'pending';
                            return (
                                <div
                                    key={t.id}
                                    className={`relative rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${isPending
                                        ? 'bg-white border-2 border-dashed border-gray-300 hover:border-gray-400'
                                        : 'bg-white hover:bg-gray-50'
                                        }`}
                                    onClick={() => onTransactionClick?.(t)}
                                >
                                    {/* Icon */}
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome
                                            ? 'bg-green-100 text-green-600'
                                            : isAllocated
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-orange-100 text-orange-600'
                                            }`}
                                    >
                                        {isIncome ? '💰' : isAllocated ? '✓' : '?'}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-1">
                                            <p className="font-medium text-gray-800 line-clamp-2">
                                                {t.merchant ?? t.description ?? 'Transaction'}
                                            </p>
                                            {t.source === 'manual' && (
                                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium flex-shrink-0" title="Manual transaction">
                                                    ✏️
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium flex-shrink-0">
                                                    Pending
                                                </span>
                                            )}
                                            {t.needsReview && (
                                                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium flex-shrink-0">
                                                    Review
                                                </span>
                                            )}
                                            {isIncome && (
                                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium flex-shrink-0">
                                                    Income
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">
                                            {isIncome
                                                ? 'Added to Available to Budget'
                                                : isAllocated
                                                    ? t.allocations.map((a) => a.bucket.name).join(', ')
                                                    : 'Tap to allocate'}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <span className={`font-bold flex-shrink-0 ${t.amount < 0 ? 'text-gray-800' : 'text-green-600'}`}>
                                        {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
