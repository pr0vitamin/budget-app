import { openDB, type IDBPDatabase } from 'idb';

// Minimal key/value store on IndexedDB, used to persist the TanStack Query cache.
const DB_NAME = 'cat-budget-cache';
const STORE = 'kv';
let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export const idbStorage = {
  getItem: async (key: string): Promise<string | null> => (await (await db()).get(STORE, key)) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    await (await db()).put(STORE, value, key);
  },
  removeItem: async (key: string): Promise<void> => {
    await (await db()).delete(STORE, key);
  },
};
