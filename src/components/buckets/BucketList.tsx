'use client';

import { useState } from 'react';
import { CatPiggyBank } from './CatPiggyBank';

interface Bucket {
    id: string;
    name: string;
    type: string;
    color: string;
    balance: number;
    autoAllocationAmount: number;
}

interface BucketGroup {
    id: string;
    name: string;
    buckets: Bucket[];
}

interface BucketListProps {
    groups: BucketGroup[];
    reservedByBucket?: Record<string, number>;
    onBucketClick?: (bucket: Bucket) => void;
    onAddBucket?: (groupId: string) => void;
    onFeed?: (bucket: Bucket) => void;
}

export function BucketList({ groups, reservedByBucket = {}, onBucketClick, onAddBucket, onFeed }: BucketListProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(groups.map((g) => g.id))
    );

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const getGroupTotal = (buckets: Bucket[]) => {
        return buckets.reduce((sum, b) => sum + b.balance, 0);
    };

    if (groups.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">🐱</div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">No buckets yet</h2>
                <p className="text-gray-500">Create a group to start organizing your money</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const total = getGroupTotal(group.buckets);

                return (
                    <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Group header */}
                        <button
                            onClick={() => toggleGroup(group.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''
                                        }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                <span className="font-semibold text-gray-800">{group.name}</span>
                                <span className="text-sm text-gray-400">({group.buckets.length})</span>
                            </div>
                            <span className={`font-bold ${total < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                ${total.toFixed(2)}
                            </span>
                        </button>

                        {/* Buckets grid */}
                        {isExpanded && (
                            <div className="px-4 pb-4">
                                <div className="grid grid-cols-3 gap-4">
                                    {group.buckets.map((bucket) => (
                                        <div key={bucket.id} className="flex flex-col items-center gap-1">
                                            <CatPiggyBank
                                                name={bucket.name}
                                                balance={bucket.balance}
                                                color={bucket.color}
                                                autoAllocationAmount={bucket.autoAllocationAmount}
                                                reserved={reservedByBucket[bucket.id] || 0}
                                                isOverspent={bucket.balance < 0}
                                                onClick={() => onBucketClick?.(bucket)}
                                            />
                                            {onFeed && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFeed(bucket);
                                                    }}
                                                    className="text-xs px-2 py-1 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-1"
                                                >
                                                    🍽️ Feed
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {/* Add bucket button */}
                                    <button
                                        onClick={() => onAddBucket?.(group.id)}
                                        className="flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        <span className="text-xs">Add</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
