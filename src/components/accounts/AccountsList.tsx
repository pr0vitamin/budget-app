'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '@/lib/query/hooks';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { showToast } from '@/lib/toast';

export function AccountsList() {
    const qc = useQueryClient();
    const { data: accounts, isLoading } = useAccounts();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [showDaysModal, setShowDaysModal] = useState(false);
    const [days, setDays] = useState(30);

    const invalidate = () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: ['accounts'] }),
            qc.invalidateQueries({ queryKey: qk.overview }),
            qc.invalidateQueries({ queryKey: qk.transactions('all') }),
        ]);

    const handleConnect = async () => {
        const isFirstConnect = !accounts || accounts.length === 0;
        if (isFirstConnect) {
            setShowDaysModal(true);
        } else {
            setConnecting(true);
            try {
                await api.connectAccounts();
                await qc.invalidateQueries({ queryKey: ['accounts'] });
                showToast('Accounts refreshed', 'success');
            } catch {
                showToast('Connect failed — try again', 'error');
            } finally {
                setConnecting(false);
            }
        }
    };

    const handleImport = async () => {
        setShowDaysModal(false);
        setConnecting(true);
        try {
            await api.connectAccounts();
            const r = await api.sync(days);
            await invalidate();
            showToast(`Bank connected — imported ${r.created ?? 0} transactions`, 'success');
        } catch {
            showToast('Connect failed — try again', 'error');
        } finally {
            setConnecting(false);
        }
    };

    const handleDelete = async (accountId: string, accountName: string) => {
        if (!confirm(`Remove "${accountName}"? Transactions from this account will be kept.`)) {
            return;
        }

        setDeletingId(accountId);

        try {
            await api.removeAccount(accountId);
            await qc.invalidateQueries({ queryKey: ['accounts'] });
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to remove account', 'error');
        } finally {
            setDeletingId(null);
        }
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

    if (isLoading) {
        return <div className="py-6 text-center text-sm text-gray-400">Loading accounts...</div>;
    }

    return (
        <div className="space-y-3">
            {/* Connect / sync accounts button */}
            <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-2 px-4 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
                {connecting ? 'Connecting...' : 'Connect bank'}
            </button>

            {(!accounts || accounts.length === 0) ? (
                <div className="text-center py-6">
                    <div className="text-4xl mb-3">🏦</div>
                    <p className="text-gray-500 mb-4">No bank accounts connected</p>
                    <p className="text-sm text-gray-400">
                        Connect accounts via <a href="https://my.akahu.nz" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">my.akahu.nz</a>,
                        then use the button above to sync.
                    </p>
                </div>
            ) : (
                accounts.map((account) => {
                    const balance = account.balanceCurrent != null ? Number(account.balanceCurrent) : null;

                    return (
                        <div
                            key={account.id}
                            className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
                        >
                            {/* Logo or fallback */}
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                                {account.connectionLogo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={account.connectionLogo}
                                        alt={account.institution}
                                        width={48}
                                        height={48}
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
                                    {account.accountNumber && ` • ${account.accountNumber}`}
                                </p>
                                {balance != null && (
                                    <p className="text-sm font-medium text-gray-700">
                                        ${balance.toFixed(2)} {account.currency}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400">
                                    {formatLastSync(account.lastSyncAt)}
                                    {account.connectionError && (
                                        <span className="text-red-500 ml-2">⚠️ {account.connectionError}</span>
                                    )}
                                </p>
                            </div>

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
                })
            )}

            {/* First-connect days modal */}
            {showDaysModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slide-up">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Import history</h3>
                        <p className="text-sm text-gray-500 mb-4">How many days of history would you like to import?</p>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Days of history
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={365}
                            value={days}
                            onChange={(e) => setDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDaysModal(false)}
                                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors"
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
