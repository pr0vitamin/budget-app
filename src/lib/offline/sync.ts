'use client';

import { getPendingActions, removePendingAction } from './db';

interface SyncResult {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; url: string; error: string }>;
}

export async function syncPendingActions(): Promise<SyncResult> {
    const actions = await getPendingActions();
    const result: SyncResult = {
        total: actions.length,
        succeeded: 0,
        failed: 0,
        errors: [],
    };

    for (const action of actions) {
        try {
            const res = await fetch(action.url, {
                method: action.method,
                headers: action.body ? { 'Content-Type': 'application/json' } : undefined,
                body: action.body ? JSON.stringify(action.body) : undefined,
            });

            if (res.ok) {
                await removePendingAction(action.id);
                result.succeeded++;
            } else {
                const data = await res.json().catch(() => ({}));
                result.failed++;
                result.errors.push({
                    id: action.id,
                    url: action.url,
                    error: data.error || `HTTP ${res.status}`,
                });
            }
        } catch (err) {
            result.failed++;
            result.errors.push({
                id: action.id,
                url: action.url,
                error: err instanceof Error ? err.message : 'Network error',
            });
        }
    }

    return result;
}

// Auto-sync when coming back online
export function setupAutoSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', async () => {
        console.log('[Offline Sync] Back online, syncing pending actions...');
        const result = await syncPendingActions();
        console.log('[Offline Sync] Result:', result);

        // Dispatch event for UI to react
        window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: result }));
    });
}
