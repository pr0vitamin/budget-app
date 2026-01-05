import { createClient } from '@/lib/supabase/server';
import { signOut } from './login/actions';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="max-w-md mx-auto pt-16 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white/10 backdrop-blur-lg rounded-3xl mb-4">
            <span className="text-6xl">🐱</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Bucket Budget</h1>
          <p className="text-white/80">Welcome back!</p>
        </div>

        {/* User Card */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600 mb-6">{user?.email}</p>

            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <p className="text-gray-500 text-sm mb-2">Available to Budget</p>
              <p className="text-4xl font-bold text-gray-800">$0.00</p>
            </div>

            <p className="text-gray-500 mb-6">
              🚧 Dashboard coming soon! We&apos;re building something delightful.
            </p>

            <form action={signOut}>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
