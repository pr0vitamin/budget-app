'use client';

import { useSwipe } from '@/hooks/useSwipe';

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

interface SwipeableTransactionItemProps {
    transaction: Transaction;
    onAllocate: (transaction: Transaction) => void;
}

export function SwipeableTransactionItem({
    transaction,
    onAllocate,
}: SwipeableTransactionItemProps) {
    const { offsetX, direction, handlers } = useSwipe({
        onSwipeLeft: () => onAllocate(transaction),
        threshold: 80,
    });

    const isExpense = transaction.amount < 0;
    const isAllocated = transaction.allocations.length > 0;

    // Calculate background reveal based on swipe
    const showAction = direction === 'left' && Math.abs(offsetX) > 20;

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* Background action reveal */}
            <div
                className={`absolute inset-0 flex items-center justify-end pr-6 bg-indigo-500 transition-opacity ${showAction ? 'opacity-100' : 'opacity-0'
                    }`}
            >
                <div className="text-white font-medium flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                    Allocate
                </div>
            </div>

            {/* Swipeable content */}
            <div
                {...handlers}
                className="relative bg-white p-4 flex items-center gap-3 cursor-grab active:cursor-grabbing"
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: offsetX === 0 ? 'transform 0.2s ease-out' : 'none',
                }}
                onClick={() => onAllocate(transaction)}
            >
                {/* Icon */}
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAllocated ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}
                >
                    {isAllocated ? '✓' : '?'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                        <p className="font-medium text-gray-800 truncate">{transaction.merchant}</p>
                        {transaction.isAmended && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                Amended
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                        {isAllocated
                            ? transaction.allocations.map((a) => a.bucket.name).join(', ')
                            : 'Swipe left or tap to allocate'}
                    </p>
                </div>

                {/* Amount */}
                <span className={`font-bold flex-shrink-0 ${isExpense ? 'text-gray-800' : 'text-green-600'}`}>
                    {isExpense ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                </span>
            </div>
        </div>
    );
}
