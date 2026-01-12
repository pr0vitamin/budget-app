'use client';

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

interface TransactionItemProps {
    transaction: Transaction;
    onClick: (transaction: Transaction) => void;
}

export function TransactionItem({
    transaction,
    onClick,
}: TransactionItemProps) {
    const isIncome = transaction.amount > 0;
    const isExpense = transaction.amount < 0;
    const isAllocated = transaction.allocations.length > 0;

    return (
        <div
            className="relative bg-white rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => onClick(transaction)}
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
                    <p className="font-medium text-gray-800 line-clamp-2">{transaction.merchant}</p>
                    {transaction.isManual && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium flex-shrink-0" title="Manual transaction">
                            ✏️
                        </span>
                    )}
                    {transaction.isAmended && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium flex-shrink-0">
                            Amended
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
                            ? transaction.allocations.map((a) => a.bucket.name).join(', ')
                            : 'Tap to allocate'}
                </p>
            </div>

            {/* Amount */}
            <span className={`font-bold flex-shrink-0 ${isExpense ? 'text-gray-800' : 'text-green-600'}`}>
                {isExpense ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
            </span>
        </div>
    );
}

// Keep the old export name for backwards compatibility
export { TransactionItem as SwipeableTransactionItem };
