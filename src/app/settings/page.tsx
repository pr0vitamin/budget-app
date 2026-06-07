'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useSettings } from '@/lib/query/hooks';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { signOut } from '@/app/login/actions';
import { AccountsList } from '@/components/accounts';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [syncDays, setSyncDays] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currentSyncDays = syncDays ?? settings?.initialSyncDays ?? 30;
  const currentTheme = theme ?? settings?.theme ?? 'system';
  const isDirty = syncDays !== null || theme !== null;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings({
        initialSyncDays: currentSyncDays,
        theme: currentTheme,
      });
      qc.invalidateQueries({ queryKey: qk.settings });
      setSyncDays(null);
      setTheme(null);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button onClick={() => signOut()} className="text-red-500 font-medium">
            Sign Out
          </button>
        </div>

        {settingsLoading && !settings ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Sync settings */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Sync</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial sync days (1–30)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={currentSyncDays}
                  onChange={(e) =>
                    setSyncDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days back to fetch transactions on first sync
                </p>
              </div>
            </div>

            {/* Theme settings */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Appearance
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        currentTheme === t
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save settings button */}
            {isDirty && (
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 mb-4"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            )}

            {/* Bank accounts */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Bank accounts
              </h2>
              <AccountsList />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
