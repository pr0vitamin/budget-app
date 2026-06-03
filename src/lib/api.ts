// Thin typed wrappers over the REST API. Throw on non-2xx so TanStack Query
// can surface errors and roll back optimistic updates.
async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface OverviewBucket {
  id: string; name: string; icon: string | null; color: string;
  targetAmount: number | null; topUpAmount: number; balance: number;
}
export interface OverviewGroup { id: string; name: string; isCollapsed: boolean; buckets: OverviewBucket[]; }
export interface Overview { groups: OverviewGroup[]; availableToBudget: number; inboxCount: number; }

export interface TxnAllocation { bucket: { id: string; name: string; color: string }; amount: number; }
export interface Transaction {
  id: string; amount: number; merchant: string | null; description: string | null;
  date: string; kind: 'income' | 'expense' | 'transfer'; status: 'pending' | 'confirmed';
  source: 'akahu' | 'manual'; needsReview: boolean; allocations: TxnAllocation[];
}
export interface Settings { id: string; userId: string; initialSyncDays: number; theme: string; }
export interface Rule { id: string; merchantPattern: string; bucketId: string; bucket: { id: string; name: string; color: string }; }

export interface Account {
  id: string; name: string; institution: string; accountType: string;
  accountNumber: string | null; balanceCurrent: number | string | null; balanceAvailable: number | string | null;
  currency: string; status: string; connectionLogo: string | null; lastSyncAt: string | null; connectionError: string | null;
}

export const api = {
  overview: () => http<Overview>('/api/overview'),
  transactions: (q = '') => http<Transaction[]>(`/api/transactions${q}`),
  settings: () => http<Settings>('/api/settings'),
  rules: () => http<Rule[]>('/api/rules'),

  feed: (bucketId: string, amount: number) =>
    http('/api/budget/allocations', { method: 'POST', body: JSON.stringify({ bucketId, amount }) }),
  feedAll: () => http<{ fed: string[] }>('/api/budget/allocations/batch', { method: 'POST' }),
  allocate: (id: string, allocations: { bucketId: string; amount: number }[]) =>
    http<Transaction>(`/api/transactions/${id}/allocate`, { method: 'POST', body: JSON.stringify({ allocations }) }),
  reclassify: (id: string, kind: string) =>
    http<Transaction>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify({ kind }) }),
  createTransaction: (data: { amount: number; date: string; merchant?: string; kind?: string }) =>
    http<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => http(`/api/transactions/${id}`, { method: 'DELETE' }),

  createGroup: (name: string) => http('/api/bucket-groups', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteGroup: (id: string) => http(`/api/bucket-groups/${id}`, { method: 'DELETE' }),
  reorderGroups: (order: string[]) => http('/api/bucket-groups/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  createBucket: (data: { groupId: string; name: string; color?: string; icon?: string; topUpAmount?: number; targetAmount?: number | null }) =>
    http('/api/buckets', { method: 'POST', body: JSON.stringify(data) }),
  updateBucket: (id: string, data: Record<string, unknown>) =>
    http(`/api/buckets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBucket: (id: string) => http(`/api/buckets/${id}`, { method: 'DELETE' }),
  reorderBuckets: (order: string[]) => http('/api/buckets/reorder', { method: 'POST', body: JSON.stringify({ order }) }),

  createRule: (merchantPattern: string, bucketId: string) =>
    http('/api/rules', { method: 'POST', body: JSON.stringify({ merchantPattern, bucketId }) }),
  deleteRule: (id: string) => http(`/api/rules/${id}`, { method: 'DELETE' }),

  updateSettings: (data: Partial<Pick<Settings, 'initialSyncDays' | 'theme'>>) =>
    http<Settings>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  accounts: () => http<Account[]>('/api/accounts'),
  connectAccounts: () => http<{ count: number }>('/api/accounts', { method: 'POST' }),
  removeAccount: (id: string) => http(`/api/accounts/${id}`, { method: 'DELETE' }),
  refreshAccount: (id: string) => http(`/api/accounts/${id}/refresh`, { method: 'POST' }),
  sync: (full = false) => http<{ created: number; updated: number; confirmed: number; flaggedReview: number }>('/api/transactions/sync', { method: 'POST', body: JSON.stringify({ full }) }),
};
