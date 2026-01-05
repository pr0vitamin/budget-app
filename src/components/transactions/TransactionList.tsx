'use client';

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
                            const isExpense = t.amount < 0;
                            const isAllocated = t.allocations.length > 0;

                            return (
                                <button
                                    key={t.id}
                                    onClick={() => onTransactionClick?.(t)}
                                    className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
                                >
                                    {/* Icon */}
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${isAllocated
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-orange-100 text-orange-600'
                                            }`}
                                    >
                                        {isAllocated ? '✓' : '?'}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{t.merchant}</p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {isAllocated
                                                ? t.allocations.map((a) => a.bucket.name).join(', ')
                                                : 'Needs allocation'}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <span
                                        className={`font-bold ${isExpense ? 'text-gray-800' : 'text-green-600'}`}
                                    >
                                        {isExpense ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
