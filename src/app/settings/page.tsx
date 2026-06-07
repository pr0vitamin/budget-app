'use client';

import { AppShell } from '@/components/layout';
import { signOut } from '@/app/login/actions';
import { AccountsList } from '@/components/accounts';

export default function SettingsPage() {
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

        {/* Bank accounts */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Bank accounts
          </h2>
          <AccountsList />
        </div>
      </div>
    </AppShell>
  );
}
