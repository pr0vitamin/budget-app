'use client';

import { SwipeableTransactionItem } from './SwipeableTransactionItem';

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
                        {dayTransactions.map((t) => (
                            <SwipeableTransactionItem
                                key={t.id}
                                transaction={t}
                                onClick={(transaction) => onTransactionClick?.(transaction)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
