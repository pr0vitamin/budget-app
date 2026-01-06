'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '../login/actions';

interface Settings {
    budgetCycleType: string;
    budgetCycleStartDay: number;
}

interface SettingsPageClientProps {
    userEmail: string;
    settings: Settings;
    accountsCount: number;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SettingsPageClient({
    userEmail,
    settings,
    accountsCount,
}: SettingsPageClientProps) {
    const router = useRouter();
    const [isEditingCycle, setIsEditingCycle] = useState(false);
    const [cycleType, setCycleType] = useState(settings.budgetCycleType);
    const [startDay, setStartDay] = useState(settings.budgetCycleStartDay);
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveCycle = async () => {
        setIsSaving(true);
        const res = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budgetCycleType: cycleType,
                budgetCycleStartDay: startDay,
            }),
        });

        if (res.ok) {
            setIsEditingCycle(false);
            router.refresh();
        }
        setIsSaving(false);
    };

    return (
        <div className="p-4">
            {/* Header */}
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

            {/* Profile section */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Profile</h2>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-lg text-white font-bold">
                            {userEmail.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{userEmail}</p>
                        <p className="text-sm text-gray-500">Signed in with magic link</p>
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
                            <span className="text-gray-700">Start day</span>
                            <span className="text-gray-500">
                                {settings.budgetCycleType === 'monthly'
                                    ? `Day ${settings.budgetCycleStartDay}`
                                    : dayNames[settings.budgetCycleStartDay]}
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

                        {/* Start day */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {cycleType === 'monthly' ? 'Start Day of Month' : 'Start Day of Week'}
                            </label>
                            {cycleType === 'monthly' ? (
                                <input
                                    type="number"
                                    min="1"
                                    max="28"
                                    value={startDay}
                                    onChange={(e) => setStartDay(parseInt(e.target.value) || 1)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {dayNames.map((day, i) => (
                                        <button
                                            key={day}
                                            onClick={() => setStartDay(i)}
                                            className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${startDay === i
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            )}
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
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                    Bank Accounts
                </h2>
                {accountsCount > 0 ? (
                    <p className="text-gray-600">{accountsCount} account(s) connected</p>
                ) : (
                    <button className="w-full py-3 text-center text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors">
                        + Connect Bank Account
                    </button>
                )}
            </div>

            {/* Data */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Data</h2>
                <div className="space-y-1">
                    <button className="w-full py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl px-2 transition-colors">
                        Export Data
                    </button>
                    <a href="/rules" className="block w-full py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl px-2 transition-colors">
                        Categorization Rules →
                    </a>
                </div>
            </div>

            {/* Sign out */}
            <form action={signOut}>
                <button
                    type="submit"
                    className="w-full py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors"
                >
                    Sign Out
                </button>
            </form>
        </div>
    );
}
