import { AppShell } from '@/components/layout';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

export default async function SettingsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <AppShell>
            <div className="p-4">
                {/* Header */}
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

                {/* Profile section */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                        Profile
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-lg text-white font-bold">
                                {user?.email?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{user?.email}</p>
                            <p className="text-sm text-gray-500">Signed in with magic link</p>
                        </div>
                    </div>
                </div>

                {/* Budget settings */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                        Budget
                    </h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-700">Budget cycle</span>
                            <span className="text-gray-500">Fortnightly</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-700">Start day</span>
                            <span className="text-gray-500">Thursday</span>
                        </div>
                    </div>
                </div>

                {/* Bank accounts */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                        Bank Accounts
                    </h2>
                    <button className="w-full py-3 text-center text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors">
                        + Connect Bank Account
                    </button>
                </div>

                {/* Data */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                        Data
                    </h2>
                    <div className="space-y-1">
                        <button className="w-full py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl px-2 transition-colors">
                            Export Data
                        </button>
                        <button className="w-full py-3 text-left text-gray-700 hover:bg-gray-50 rounded-xl px-2 transition-colors">
                            Categorization Rules
                        </button>
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
        </AppShell>
    );
}
