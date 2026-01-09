'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '../login/actions';
import { AccountsList } from '@/components/accounts';

interface Settings {
    budgetCycleType: string;
    budgetCycleStartDate: string; // ISO date string
}

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

interface SettingsPageClientProps {
    userEmail: string;
    settings: Settings;
    accounts: Account[];
}

export function SettingsPageClient({
    userEmail,
    settings,
    accounts,
}: SettingsPageClientProps) {
    const router = useRouter();
    const [isEditingCycle, setIsEditingCycle] = useState(false);
    const [cycleType, setCycleType] = useState(settings.budgetCycleType);
    const [startDate, setStartDate] = useState(settings.budgetCycleStartDate.split('T')[0]); // YYYY-MM-DD
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveCycle = async () => {
        setIsSaving(true);
        const res = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budgetCycleType: cycleType,
                ...(startDate && { budgetCycleStartDate: startDate }),
            }),
        });

        if (res.ok) {
            setIsEditingCycle(false);
            router.refresh();
        }
        setIsSaving(false);
    };

    const formatDisplayDate = (dateStr: string) => {
        // Parse as UTC to avoid timezone shift
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NZ', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        });
    };

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <button
                    onClick={() => signOut()}
                    className="text-red-500 font-medium"
                >
                    Sign Out
                </button>
            </div>

            {/* Account info */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Account</h2>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-xl">🐱</span>
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{userEmail}</p>
                        <p className="text-sm text-gray-500">Cat Budget User</p>
                    </div>
                </div>
            </div>

            {/* Budget settings */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Budget</h2>

                {!isEditingCycle ? (
                    <div className="space-y-3">
                        <button
                            onClick={() => setIsEditingCycle(true)}
                            className="w-full flex items-center justify-between py-2 text-left"
                        >
                            <span className="text-gray-700">Budget cycle</span>
                            <span className="text-gray-500 capitalize">{settings.budgetCycleType}</span>
                        </button>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-700">Start date</span>
                            <span className="text-gray-500">
                                {formatDisplayDate(settings.budgetCycleStartDate)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Cycle type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cycle Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['weekly', 'fortnightly', 'monthly'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setCycleType(type)}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${cycleType === type
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Start date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Date
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Pick a date when your budget cycle starts (e.g., your last payday)
                            </p>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsEditingCycle(false)}
                                className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCycle}
                                disabled={isSaving}
                                className="flex-1 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bank accounts */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Bank Accounts</h2>
                <AccountsList accounts={accounts} />
            </div>

            {/* Navigation */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">More</h2>
                <a
                    href="/rules"
                    className="flex items-center justify-between py-3 text-gray-700 hover:text-indigo-600 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🏷️</span>
                        <div>
                            <p className="font-medium">Auto-Categorization Rules</p>
                            <p className="text-sm text-gray-500">Manage merchant → cat mappings</p>
                        </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>
        </div>
    );
}
