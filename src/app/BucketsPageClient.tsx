'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BucketList, BucketForm, ReorderGroupsModal } from '@/components/buckets';
import { signOut } from './login/actions';

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

interface BucketsPageClientProps {
    groups: BucketGroup[];
    totalAvailable: number;
    availableToBudget: number;
    userEmail: string;
}

interface BucketFormState {
    isOpen: boolean;
    groupId: string;
    bucket?: Bucket;
}

export function BucketsPageClient({ groups, totalAvailable, availableToBudget, userEmail }: BucketsPageClientProps) {
    const router = useRouter();
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [bucketForm, setBucketForm] = useState<BucketFormState>({ isOpen: false, groupId: '' });
    const [isReorderingGroups, setIsReorderingGroups] = useState(false);
    const [reservedByBucket, setReservedByBucket] = useState<Record<string, number>>({});

    // Fetch reserved amounts on mount and when groups change
    useEffect(() => {
        const fetchReserved = async () => {
            try {
                const res = await fetch('/api/buckets/reserved');
                if (res.ok) {
                    const data = await res.json();
                    setReservedByBucket(data.reserved || {});
                }
            } catch {
                // Silently fail
            }
        };
        fetchReserved();
    }, [groups]);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        const res = await fetch('/api/bucket-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newGroupName.trim() }),
        });

        if (res.ok) {
            setNewGroupName('');
            setIsCreatingGroup(false);
            router.refresh();
        }
    };

    const handleBucketClick = (bucket: Bucket, groupId: string) => {
        setBucketForm({ isOpen: true, groupId, bucket });
    };

    const handleAddBucket = (groupId: string) => {
        setBucketForm({ isOpen: true, groupId });
    };

    const handleBucketSubmit = async (data: {
        name: string;
        type: 'spending' | 'savings';
        color: string;
        autoAllocationAmount: number;
        rollover: boolean;
    }) => {
        const isEditing = !!bucketForm.bucket;
        const url = isEditing
            ? `/api/buckets/${bucketForm.bucket!.id}`
            : '/api/buckets';

        const res = await fetch(url, {
            method: isEditing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                groupId: bucketForm.groupId,
            }),
        });

        if (res.ok) {
            setBucketForm({ isOpen: false, groupId: '' });
            router.refresh();
        }
    };

    const handleBucketDelete = async () => {
        if (!bucketForm.bucket) return;

        const res = await fetch(`/api/buckets/${bucketForm.bucket.id}`, {
            method: 'DELETE',
        });

        if (res.ok) {
            setBucketForm({ isOpen: false, groupId: '' });
            router.refresh();
        }
    };

    const handleReorderSave = async (orderedIds: string[]) => {
        const res = await fetch('/api/bucket-groups/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds }),
        });

        if (res.ok) {
            setIsReorderingGroups(false);
            router.refresh();
        }
    };

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Buckets</h1>
                    <p className="text-gray-500 text-sm">{userEmail}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Available to Budget</p>
                    <p className={`text-xl font-bold ${availableToBudget > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        ${availableToBudget.toFixed(2)}
                    </p>
                    {totalAvailable !== 0 && (
                        <p className="text-xs text-gray-500">
                            Total in buckets: ${totalAvailable.toFixed(2)}
                        </p>
                    )}
                </div>
            </div>

            {/* Reorder button */}
            {groups.length > 1 && (
                <button
                    onClick={() => setIsReorderingGroups(true)}
                    className="mb-4 text-sm text-indigo-600 flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    Reorder Groups
                </button>
            )}

            {/* Bucket list */}
            <BucketList
                groups={groups}
                reservedByBucket={reservedByBucket}
                onBucketClick={(bucket) => {
                    const group = groups.find(g => g.buckets.some(b => b.id === bucket.id));
                    if (group) handleBucketClick(bucket, group.id);
                }}
                onAddBucket={handleAddBucket}
            />

            {/* Add group button */}
            {!isCreatingGroup ? (
                <button
                    onClick={() => setIsCreatingGroup(true)}
                    className="w-full mt-4 py-3 text-center text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors border-2 border-dashed border-indigo-200"
                >
                    + Add Bucket Group
                </button>
            ) : (
                <form onSubmit={handleCreateGroup} className="mt-4 bg-white rounded-xl p-4 shadow-sm">
                    <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group name (e.g., Essentials)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsCreatingGroup(false)}
                            className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                        >
                            Create
                        </button>
                    </div>
                </form>
            )}

            {/* Sign out */}
            <form action={signOut} className="mt-8">
                <button
                    type="submit"
                    className="w-full py-3 text-gray-500 text-sm hover:text-gray-700"
                >
                    Sign Out
                </button>
            </form>

            {/* Bucket Form Modal */}
            {bucketForm.isOpen && (
                <BucketForm
                    groupId={bucketForm.groupId}
                    initialData={bucketForm.bucket ? {
                        name: bucketForm.bucket.name,
                        type: bucketForm.bucket.type as 'spending' | 'savings',
                        color: bucketForm.bucket.color,
                        autoAllocationAmount: bucketForm.bucket.autoAllocationAmount,
                        rollover: true,
                    } : undefined}
                    bucketId={bucketForm.bucket?.id}
                    onSubmit={handleBucketSubmit}
                    onCancel={() => setBucketForm({ isOpen: false, groupId: '' })}
                    onDelete={bucketForm.bucket ? handleBucketDelete : undefined}
                />
            )}

            {/* Reorder Groups Modal */}
            {isReorderingGroups && (
                <ReorderGroupsModal
                    groups={groups.map(g => ({ id: g.id, name: g.name }))}
                    onSave={handleReorderSave}
                    onCancel={() => setIsReorderingGroups(false)}
                />
            )}
        </div>
    );
}
