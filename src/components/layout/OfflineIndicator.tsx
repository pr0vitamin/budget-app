'use client';

import { useEffect } from 'react';
import { useOnlineStatus, usePendingActions, setupAutoSync } from '@/lib/offline';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();
    const { count: pendingCount } = usePendingActions();

    // Set up auto-sync on mount
    useEffect(() => {
        setupAutoSync();
    }, []);

    // Show nothing if online and no pending actions
    if (isOnline && pendingCount === 0) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            {!isOnline && (
                <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                    </svg>
                    You&apos;re offline - changes will sync when connected
                </div>
            )}
            {pendingCount > 0 && isOnline && (
                <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm font-medium">
                    Syncing {pendingCount} pending change{pendingCount > 1 ? 's' : ''}...
                </div>
            )}
        </div>
    );
}
