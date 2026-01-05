'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BucketList } from '@/components/buckets';
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
    userEmail: string;
}

export function BucketsPageClient({ groups, totalAvailable, userEmail }: BucketsPageClientProps) {
    const router = useRouter();
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

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

    const handleBucketClick = (bucket: Bucket) => {
        // TODO: Open bucket detail/edit modal
        console.log('Clicked bucket:', bucket);
    };

    const handleAddBucket = async (groupId: string) => {
        const name = prompt('Bucket name:');
        if (!name) return;

        const res = await fetch('/api/buckets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, name }),
        });

        if (res.ok) {
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
                    <p className={`text-xl font-bold ${totalAvailable < 0 ? 'text-red-500' : 'text-indigo-600'}`}>
                        ${totalAvailable.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Bucket list */}
            <BucketList
                groups={groups}
                onBucketClick={handleBucketClick}
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
        </div>
    );
}
