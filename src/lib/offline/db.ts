import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
    bucketGroups: {
        key: string;
        value: {
            id: string;
            name: string;
            sortOrder: number;
            buckets: Array<{
                id: string;
                name: string;
                type: string;
                color: string;
                balance: number;
                autoAllocationAmount: number;
            }>;
        };
    };
    transactions: {
        key: string;
        value: {
            id: string;
            amount: number;
            merchant: string;
            date: string;
            description?: string;
            isManual: boolean;
            allocations: Array<{
                bucket: { id: string; name: string; color: string };
                amount: number;
            }>;
        };
    };
    scheduled: {
        key: string;
        value: {
            id: string;
            name: string;
            amount: number;
            frequency: string;
            interval: number;
            nextDue: string;
            startDate: string;
            enabled: boolean;
            bucket: { id: string; name: string; color: string };
        };
    };
    settings: {
        key: string;
        value: {
            key: string;
            budgetCycleType: string;
            budgetCycleStartDate: string;
            availableToBudget: number;
        };
    };
    pendingActions: {
        key: string;
        value: {
            id: string;
            type: 'allocation' | 'feed' | 'transaction' | 'scheduled' | 'settings';
            method: 'POST' | 'PATCH' | 'DELETE';
            url: string;
            body: unknown;
            createdAt: string;
        };
        indexes: { 'by-created': string };
    };
}

const DB_NAME = 'cat-budget-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
    if (!dbPromise) {
        dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Bucket groups store
                if (!db.objectStoreNames.contains('bucketGroups')) {
                    db.createObjectStore('bucketGroups', { keyPath: 'id' });
                }
                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    db.createObjectStore('transactions', { keyPath: 'id' });
                }
                // Scheduled transactions store
                if (!db.objectStoreNames.contains('scheduled')) {
                    db.createObjectStore('scheduled', { keyPath: 'id' });
                }
                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                // Pending actions queue
                if (!db.objectStoreNames.contains('pendingActions')) {
                    const store = db.createObjectStore('pendingActions', { keyPath: 'id' });
                    store.createIndex('by-created', 'createdAt');
                }
            },
        });
    }
    return dbPromise;
}

// Cache bucket groups
export async function cacheBucketGroups(groups: OfflineDB['bucketGroups']['value'][]) {
    const db = await getDB();
    const tx = db.transaction('bucketGroups', 'readwrite');
    await tx.store.clear();
    for (const group of groups) {
        await tx.store.put(group);
    }
    await tx.done;
}

export async function getCachedBucketGroups(): Promise<OfflineDB['bucketGroups']['value'][]> {
    const db = await getDB();
    return db.getAll('bucketGroups');
}

// Cache transactions
export async function cacheTransactions(transactions: OfflineDB['transactions']['value'][]) {
    const db = await getDB();
    const tx = db.transaction('transactions', 'readwrite');
    await tx.store.clear();
    for (const t of transactions) {
        await tx.store.put(t);
    }
    await tx.done;
}

export async function getCachedTransactions(): Promise<OfflineDB['transactions']['value'][]> {
    const db = await getDB();
    return db.getAll('transactions');
}

// Cache scheduled
export async function cacheScheduled(scheduled: OfflineDB['scheduled']['value'][]) {
    const db = await getDB();
    const tx = db.transaction('scheduled', 'readwrite');
    await tx.store.clear();
    for (const s of scheduled) {
        await tx.store.put(s);
    }
    await tx.done;
}

export async function getCachedScheduled(): Promise<OfflineDB['scheduled']['value'][]> {
    const db = await getDB();
    return db.getAll('scheduled');
}

// Cache settings
export async function cacheSettings(settings: Omit<OfflineDB['settings']['value'], 'key'>) {
    const db = await getDB();
    await db.put('settings', { key: 'user-settings', ...settings });
}

export async function getCachedSettings(): Promise<OfflineDB['settings']['value'] | undefined> {
    const db = await getDB();
    return db.get('settings', 'user-settings');
}

// Pending actions queue
export async function addPendingAction(
    action: Omit<OfflineDB['pendingActions']['value'], 'id' | 'createdAt'>
): Promise<string> {
    const db = await getDB();
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db.add('pendingActions', {
        ...action,
        id,
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function getPendingActions(): Promise<OfflineDB['pendingActions']['value'][]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingActions', 'by-created');
}

export async function removePendingAction(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingActions', id);
}

export async function getPendingActionsCount(): Promise<number> {
    const db = await getDB();
    return db.count('pendingActions');
}
