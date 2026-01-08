'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingActionsCount, addPendingAction } from './db';
import { syncPendingActions } from './sync';

// Hook to track online/offline status
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

// Hook to track pending actions count
export function usePendingActions() {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        try {
            const c = await getPendingActionsCount();
            setCount(c);
        } catch {
            // IndexedDB not available
        }
    }, []);

    useEffect(() => {
        refresh();

        // Listen for sync complete events
        const handleSyncComplete = () => refresh();
        window.addEventListener('offline-sync-complete', handleSyncComplete);

        // Refresh periodically
        const interval = setInterval(refresh, 5000);

        return () => {
            window.removeEventListener('offline-sync-complete', handleSyncComplete);
            clearInterval(interval);
        };
    }, [refresh]);

    return { count, refresh };
}

// Hook for making API calls with offline support
export function useOfflineAwareFetch() {
    const isOnline = useOnlineStatus();
    const { refresh: refreshPending } = usePendingActions();

    const offlineFetch = useCallback(async (
        url: string,
        options: RequestInit & { offlineType?: 'allocation' | 'feed' | 'transaction' | 'scheduled' | 'settings' } = {}
    ): Promise<Response> => {
        const { offlineType, ...fetchOptions } = options;

        if (isOnline) {
            return fetch(url, fetchOptions);
        }

        // Offline - queue the action
        if (offlineType && fetchOptions.method && fetchOptions.method !== 'GET') {
            await addPendingAction({
                type: offlineType,
                method: fetchOptions.method as 'POST' | 'PATCH' | 'DELETE',
                url,
                body: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
            });
            refreshPending();

            // Return a fake successful response
            return new Response(JSON.stringify({ queued: true }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // GET request while offline - will fail
        throw new Error('Network unavailable');
    }, [isOnline, refreshPending]);

    const manualSync = useCallback(async () => {
        if (!isOnline) return { total: 0, succeeded: 0, failed: 0, errors: [] };
        return syncPendingActions();
    }, [isOnline]);

    return { offlineFetch, isOnline, manualSync };
}
