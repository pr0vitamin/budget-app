'use client';

import { useSyncExternalStore } from 'react';
import { getToasts, subscribeToasts, dismissToast, type Toast } from '@/lib/toast';

const typeStyles: Record<Toast['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800',
};

// App-level toast stack. Rendered once (in Providers) so it persists across
// client-side navigation.
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${typeStyles[t.type]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
