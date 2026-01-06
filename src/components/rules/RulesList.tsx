'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Rule {
    id: string;
    merchantPattern: string;
    bucket: {
        id: string;
        name: string;
        color: string;
    };
    createdAt: string;
}

interface RulesListProps {
    rules: Rule[];
}

export function RulesList({ rules }: RulesListProps) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (ruleId: string) => {
        if (!confirm('Delete this rule? Existing allocations will not be affected.')) {
            return;
        }

        setDeletingId(ruleId);

        try {
            const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
            if (res.ok) {
                router.refresh();
            }
        } finally {
            setDeletingId(null);
        }
    };

    if (rules.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-3">🤖</div>
                <p>No auto-categorization rules yet.</p>
                <p className="text-sm mt-1">
                    Create rules when allocating transactions by checking
                    "Always allocate to this bucket".
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {rules.map((rule) => (
                <div
                    key={rule.id}
                    className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm"
                >
                    {/* Bucket color indicator */}
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: rule.bucket.color + '30' }}
                    >
                        🏷️
                    </div>

                    {/* Rule details */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                            "{rule.merchantPattern}"
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                            → {rule.bucket.name}
                        </p>
                    </div>

                    {/* Delete button */}
                    <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={deletingId === rule.id}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2 disabled:opacity-50"
                    >
                        {deletingId === rule.id ? (
                            <span className="text-sm">...</span>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        )}
                    </button>
                </div>
            ))}
        </div>
    );
}
