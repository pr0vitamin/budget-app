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
    recentlyFedIds?: Set<string>;
    onBucketClick?: (bucket: Bucket) => void;
    onAddBucket?: (groupId: string) => void;
    onFeed?: (bucket: Bucket) => void;
    onRenameGroup?: (groupId: string, newName: string) => Promise<void>;
    onDeleteGroup?: (groupId: string) => Promise<void>;
}

export function BucketList({ groups, reservedByBucket = {}, recentlyFedIds = new Set(), onBucketClick, onAddBucket, onFeed, onRenameGroup, onDeleteGroup }: BucketListProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(groups.map((g) => g.id))
    );
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
                <h2 className="text-lg font-semibold text-gray-800 mb-2">No cats yet</h2>
                <p className="text-gray-500">Create a clowder (group) of cats to start organizing your money</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Delete error toast */}
            {deleteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
                    <span className="text-sm">{deleteError}</span>
                    <button
                        onClick={() => setDeleteError(null)}
                        className="text-red-500 hover:text-red-700"
                    >
                        ✕
                    </button>
                </div>
            )}
            {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const total = getGroupTotal(group.buckets);

                return (
                    <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Group header */}
                        <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="flex items-center gap-2 flex-1"
                            >
                                <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {editingGroupId === group.id ? (
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (onRenameGroup && editingName.trim()) {
                                                await onRenameGroup(group.id, editingName.trim());
                                            }
                                            setEditingGroupId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2"
                                    >
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="px-2 py-1 border rounded text-sm font-semibold"
                                            autoFocus
                                            onBlur={() => setEditingGroupId(null)}
                                        />
                                    </form>
                                ) : (
                                    <>
                                        <span className="font-semibold text-gray-800">{group.name}</span>
                                        <span className="text-sm text-gray-400">({group.buckets.length})</span>
                                    </>
                                )}
                            </button>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${total < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                    ${total.toFixed(2)}
                                </span>
                                {/* Edit button */}
                                {onRenameGroup && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingGroupId(group.id);
                                            setEditingName(group.name);
                                        }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                        title="Rename clowder"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                )}
                                {/* Delete button */}
                                {onDeleteGroup && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            setDeleteError(null);
                                            try {
                                                await onDeleteGroup(group.id);
                                            } catch (err) {
                                                setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
                                            }
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Delete clowder"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

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
                                                showSparkle={recentlyFedIds.has(bucket.id)}
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
