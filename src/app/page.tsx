import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout';
import { signOut } from './login/actions';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Buckets</h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Available to Budget</p>
            <p className="text-xl font-bold text-indigo-600">$0.00</p>
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">🐱</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">No buckets yet</h2>
          <p className="text-gray-500 mb-6">Create your first bucket to start organizing your money</p>
          <button className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all">
            Create Bucket
          </button>
        </div>

        {/* Temp sign out */}
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="w-full py-3 text-gray-500 text-sm hover:text-gray-700"
          >
            Sign Out
          </button>
        </form>
      </div>
    </AppShell>
  );
}
