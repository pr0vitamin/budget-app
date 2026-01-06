'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
    id: string;
    name: string;
    institution: string;
    accountType: string;
    formattedAccount: string | null;
    balanceCurrent: number | null;
    status: string;
    connectionLogo: string | null;
    lastSyncAt: string | null;
    connectionError: string | null;
}

interface AccountsListProps {
    accounts: Account[];
}

export function AccountsList({ accounts }: AccountsListProps) {
    const router = useRouter();
    const [refreshingId, setRefreshingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRefresh = async (accountId: string) => {
        setRefreshingId(accountId);
        setError(null);

        try {
            const res = await fetch(`/api/accounts/${accountId}/refresh`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Refresh failed');
                return;
            }

            router.refresh();
        } catch {
            setError('Failed to refresh');
        } finally {
            setRefreshingId(null);
        }
    };

    const handleDelete = async (accountId: string, accountName: string) => {
        if (!confirm(`Remove "${accountName}"? Transactions from this account will be kept.`)) {
            return;
        }

        setDeletingId(accountId);
        setError(null);

        try {
            const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to remove account');
                return;
            }

            router.refresh();
        } catch {
            setError('Failed to remove account');
        } finally {
            setDeletingId(null);
        }
    };

    const handleSyncAll = async () => {
        setError(null);
        let refreshedCount = 0;
        let skippedCount = 0;

        for (const account of accounts) {
            const rateLimit = getRateLimitInfo(account.lastSyncAt);
            if (!rateLimit.isLimited) {
                try {
                    const res = await fetch(`/api/accounts/${account.id}/refresh`, { method: 'POST' });
                    if (res.ok) {
                        refreshedCount++;
                    } else if (res.status === 429) {
                        skippedCount++;
                    }
                } catch {
                    // Continue with other accounts
                }
            } else {
                skippedCount++;
            }
        }

        if (refreshedCount === 0 && skippedCount > 0) {
            setError(`All accounts are on cooldown. Try again later.`);
        }

        router.refresh();
    };

    const formatLastSync = (lastSyncAt: string | null) => {
        if (!lastSyncAt) return 'Never synced';
        const date = new Date(lastSyncAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
        return date.toLocaleDateString('en-NZ');
    };

    // Check if account is rate limited (1 hour cooldown)
    const COOLDOWN_MS = 60 * 60 * 1000;
    const getRateLimitInfo = (lastSyncAt: string | null) => {
        if (!lastSyncAt) return { isLimited: false, remainingMins: 0 };
        const lastSync = new Date(lastSyncAt).getTime();
        const now = Date.now();
        const elapsed = now - lastSync;
        const remaining = COOLDOWN_MS - elapsed;

        if (remaining <= 0) return { isLimited: false, remainingMins: 0 };
        return { isLimited: true, remainingMins: Math.ceil(remaining / 60000) };
    };

    if (accounts.length === 0) {
        return (
            <div className="text-center py-6">
                <div className="text-4xl mb-3">🏦</div>
                <p className="text-gray-500 mb-4">No bank accounts connected</p>
                <button
                    onClick={handleSyncAll}
                    className="px-6 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors"
                >
                    Sync Accounts from Akahu
                </button>
                <p className="text-xs text-gray-400 mt-2">
                    Make sure you've connected accounts at my.akahu.nz
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {accounts.map((account) => {
                const rateLimit = getRateLimitInfo(account.lastSyncAt);

                return (
                    <div
                        key={account.id}
                        className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
                    >
                        {/* Logo or fallback */}
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                            {account.connectionLogo ? (
                                <img
                                    src={account.connectionLogo}
                                    alt={account.institution}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <span className="text-2xl">🏦</span>
                            )}
                        </div>

                        {/* Account details */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{account.name}</p>
                            <p className="text-sm text-gray-500 truncate">
                                {account.institution}
                                {account.formattedAccount && ` • ${account.formattedAccount}`}
                            </p>
                            <p className="text-xs text-gray-400">
                                {formatLastSync(account.lastSyncAt)}
                                {rateLimit.isLimited && (
                                    <span className="text-amber-600 ml-2">
                                        ⏱️ {rateLimit.remainingMins}m until next sync
                                    </span>
                                )}
                                {account.connectionError && (
                                    <span className="text-red-500 ml-2">⚠️ {account.connectionError}</span>
                                )}
                            </p>
                        </div>

                        {/* Balance */}
                        {account.balanceCurrent !== null && (
                            <div className="text-right">
                                <p className={`font-bold ${account.balanceCurrent >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                                    ${account.balanceCurrent.toFixed(2)}
                                </p>
                            </div>
                        )}

                        {/* Refresh button */}
                        <button
                            onClick={() => handleRefresh(account.id)}
                            disabled={refreshingId === account.id || rateLimit.isLimited}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${rateLimit.isLimited
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-indigo-600 hover:bg-indigo-50'
                                }`}
                            title={rateLimit.isLimited ? `Rate limited: ${rateLimit.remainingMins}m remaining` : 'Refresh bank data'}
                        >
                            {refreshingId === account.id ? (
                                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                        </button>

                        {/* Delete button */}
                        <button
                            onClick={() => handleDelete(account.id, account.name)}
                            disabled={deletingId === account.id}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Remove account"
                        >
                            {deletingId === account.id ? (
                                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                );
            })}

            <button
                onClick={handleSyncAll}
                className="w-full py-3 text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors"
            >
                Refresh All Accounts
            </button>
        </div>
    );
}
