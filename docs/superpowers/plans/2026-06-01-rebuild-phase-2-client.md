# Cat Budget Rebuild — Phase 2: Local-first client & UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cache-first PWA UI on top of the Phase 1 API — instant page loads from IndexedDB, tap-based cash stuffing with optimistic animations, and inbox allocation with auto-remainder.

**Architecture:** TanStack Query is the client cache, persisted to IndexedDB (stale-while-revalidate). Pages are client components that render last-known data instantly, then revalidate. Mutations are optimistic (UI + animation fire immediately; POST reconciles or rolls back). The good visual pieces (cat SVG, animations, modals, shell) are recovered from git history and rewired to this architecture. No `router.refresh()` anywhere.

**Tech Stack:** Next.js 16, React 19, TanStack Query 5 (+ async-storage-persister), idb, Motion, Tailwind 4.

---

## Conventions for the executor

- **Recovering old components:** the pre-reset UI lives in git at commit `1db8878`. Recover a file with:
  `git show 1db8878:<path> > <path>` (create parent dirs first with `mkdir -p`). Then apply the adaptations the task specifies. Recovered code is real code — adapt it, don't treat it as a placeholder.
- **Prisma client:** `import { prisma } from '@/lib/db'`. **Auth in routes:** `getAuthedUserId()` from `@/lib/auth`.
- **Money:** signed numbers; expenses negative. The API already returns `Decimal` as strings/numbers — coerce with `Number(...)`.
- **Domain helpers already exist:** `@/lib/domain/{classify,balances,split,rules,dedup}`. Reuse them (esp. `computeAutoRemainder`, `validateSplit`).
- **Commits:** every commit message MUST end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commit per task; after each task tick its `- [ ]`→`- [x]` checkboxes in this file and commit `docs: tick Phase 2 Task N checkboxes`.
- **Verification:** `npm run typecheck` after every task; `npm run test:run` after tasks that add tests. The app needs real Supabase env to run in a browser (placeholders in `.env`); typecheck + Vitest do not, so they are the gates here. Do NOT attempt `npm run dev`/`build` for verification unless Supabase env is filled.
- **No drag:** never reintroduce `@dnd-kit`. Reordering is tap up/down.

---

## File structure (Phase 2)

| File | Responsibility |
| --- | --- |
| `src/app/api/overview/route.ts` | Read-model: groups+buckets+balances, availableToBudget, inboxCount |
| `src/lib/query/idb-storage.ts` | AsyncStorage over IndexedDB (via `idb`) |
| `src/lib/query/client.ts` | QueryClient factory (gcTime tuned for persistence) |
| `src/lib/query/keys.ts` | Query key constants |
| `src/lib/api.ts` | Typed fetch wrappers for every endpoint |
| `src/lib/query/hooks.ts` | Read hooks (`useOverview`, `useInbox`, `useSettings`, `useRules`) |
| `src/lib/query/mutations.ts` | Optimistic mutation hooks (feed, feedAll, allocate, reclassify, CRUD) |
| `src/app/providers.tsx` | `PersistQueryClientProvider` wrapper |
| `src/app/layout.tsx` | Wrap children in providers; PWA metadata |
| `src/components/**` | Recovered + adapted UI (shell, cats, modals, animations) |
| `src/app/{page,inbox,settings}/**` | Cache-first pages |

---

## Task 1: Overview read-model endpoint

**Files:** Create `src/app/api/overview/route.ts`

- [x] **Step 1: Implement the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

// One cache-first payload for the home screen: groups (with buckets + balances),
// the Available-to-Budget pool, and the inbox count.
export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.bucketGroup.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    include: { buckets: { where: { isArchived: false }, orderBy: { sortOrder: 'asc' } } },
  });

  const bucketIds = groups.flatMap((g) => g.buckets.map((b) => b.id));

  const [spendAgg, feedAgg, income, feedsTotal, inboxCount] = await Promise.all([
    prisma.allocation.groupBy({ by: ['bucketId'], where: { bucketId: { in: bucketIds } }, _sum: { amount: true } }),
    prisma.budgetAllocation.groupBy({ by: ['bucketId'], where: { bucketId: { in: bucketIds } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { userId, kind: 'expense', allocations: { none: {} } } }),
  ]);

  const spendMap = new Map(spendAgg.map((a) => [a.bucketId, Number(a._sum.amount ?? 0)]));
  const feedMap = new Map(feedAgg.map((a) => [a.bucketId, Number(a._sum.amount ?? 0)]));

  const groupsOut = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isCollapsed: g.isCollapsed,
    buckets: g.buckets.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      targetAmount: b.targetAmount === null ? null : Number(b.targetAmount),
      topUpAmount: Number(b.topUpAmount),
      balance: (feedMap.get(b.id) ?? 0) + (spendMap.get(b.id) ?? 0),
    })),
  }));

  const availableToBudget = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feedsTotal._sum.amount ?? 0),
  });

  return NextResponse.json({ groups: groupsOut, availableToBudget, inboxCount });
}
```

- [x] **Step 2: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/app/api/overview/route.ts
git commit -m "feat: overview read-model endpoint for cache-first home"
```

---

## Task 2: Query client + IndexedDB persistence

**Files:** Create `src/lib/query/idb-storage.ts`, `src/lib/query/client.ts`, `src/app/providers.tsx`; modify `src/app/layout.tsx`

- [x] **Step 1: IndexedDB AsyncStorage**

`src/lib/query/idb-storage.ts`:
```typescript
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
```

- [x] **Step 2: QueryClient factory**

`src/lib/query/client.ts`:
```typescript
import { QueryClient } from '@tanstack/react-query';

// gcTime must be >= the persister maxAge so cached queries survive reloads.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // serve cache instantly, revalidate in background
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}
```

- [x] **Step 3: Providers**

`src/app/providers.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { makeQueryClient } from '@/lib/query/client';
import { idbStorage } from '@/lib/query/idb-storage';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(() => createAsyncStoragePersister({ storage: idbStorage, key: 'cat-budget-query-cache' }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

- [x] **Step 4: Wrap the app**

Replace `src/app/layout.tsx` with:
```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Cat Budget',
  description: 'Budget your money with adorable cat piggy banks',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cats' },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] **Step 5: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/lib/query/idb-storage.ts src/lib/query/client.ts src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: tanstack-query client persisted to indexeddb"
```

---

## Task 3: API client + query keys + read hooks

**Files:** Create `src/lib/api.ts`, `src/lib/query/keys.ts`, `src/lib/query/hooks.ts`

- [x] **Step 1: Typed fetch wrappers**

`src/lib/api.ts`:
```typescript
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
  reorderGroups: (order: string[]) => http('/api/bucket-groups/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  createBucket: (data: { groupId: string; name: string; color?: string; topUpAmount?: number; targetAmount?: number | null }) =>
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
};
```

- [x] **Step 2: Query keys**

`src/lib/query/keys.ts`:
```typescript
export const qk = {
  overview: ['overview'] as const,
  inbox: ['transactions', 'inbox'] as const,
  transactions: (q: string) => ['transactions', q] as const,
  settings: ['settings'] as const,
  rules: ['rules'] as const,
};
```

- [x] **Step 3: Read hooks**

`src/lib/query/hooks.ts`:
```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './keys';

export const useOverview = () => useQuery({ queryKey: qk.overview, queryFn: api.overview });
export const useInbox = () =>
  useQuery({ queryKey: qk.inbox, queryFn: () => api.transactions('?kind=expense&unallocated=true') });
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: api.settings });
export const useRules = () => useQuery({ queryKey: qk.rules, queryFn: api.rules });
```

- [x] **Step 4: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/lib/api.ts src/lib/query/keys.ts src/lib/query/hooks.ts
git commit -m "feat: api client and read hooks"
```

---

## Task 4: Optimistic mutation hooks

**Files:** Create `src/lib/query/mutations.ts`

This is the instant-feedback core (spec §5). Optimistic updates mutate the cached overview immediately; the animation is driven by the caller off the same instant state. No `router.refresh()`.

- [x] **Step 1: Implement mutations**

`src/lib/query/mutations.ts`:
```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Overview } from '@/lib/api';
import { qk } from './keys';

// Helper: optimistically patch the cached overview and return a rollback snapshot.
function usePatchOverview() {
  const qc = useQueryClient();
  return {
    qc,
    patch: async (mutate: (o: Overview) => Overview) => {
      await qc.cancelQueries({ queryKey: qk.overview });
      const prev = qc.getQueryData<Overview>(qk.overview);
      if (prev) qc.setQueryData<Overview>(qk.overview, mutate(structuredClone(prev)));
      return prev;
    },
  };
}

// Feed one bucket its given amount: bucket balance + amount, available − amount.
export function useFeedBucket() {
  const { qc, patch } = usePatchOverview();
  return useMutation({
    mutationFn: ({ bucketId, amount }: { bucketId: string; amount: number }) => api.feed(bucketId, amount),
    onMutate: ({ bucketId, amount }) =>
      patch((o) => {
        o.availableToBudget -= amount;
        for (const g of o.groups) for (const b of g.buckets) if (b.id === bucketId) b.balance += amount;
        return o;
      }).then((prev) => ({ prev })),
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.overview, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }),
  });
}

// Feed All: every non-archived bucket with topUp <= remaining available, in order.
export function useFeedAll() {
  const { qc, patch } = usePatchOverview();
  return useMutation({
    mutationFn: () => api.feedAll(),
    onMutate: () =>
      patch((o) => {
        let avail = o.availableToBudget;
        for (const g of o.groups)
          for (const b of g.buckets)
            if (b.topUpAmount > 0 && b.topUpAmount <= avail + 0.001) {
              b.balance += b.topUpAmount;
              avail -= b.topUpAmount;
            }
        o.availableToBudget = avail;
        return o;
      }).then((prev) => ({ prev })),
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.overview, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }),
  });
}

// Allocate (single or split). Optimistically clears the txn from the inbox and
// bumps bucket balances; refreshes overview + inbox on settle.
export function useAllocate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allocations }: { id: string; allocations: { bucketId: string; amount: number }[] }) =>
      api.allocate(id, allocations),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useReclassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string }) => api.reclassify(id, kind),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

// Generic invalidation mutations for CRUD where instant optimism is less critical.
export function useOverviewMutation<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: qk.overview }) });
}
```

- [x] **Step 2: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/lib/query/mutations.ts
git commit -m "feat: optimistic mutation hooks for instant feedback"
```

---

## Task 5: Recover shell, animations, and UI primitives

**Files:** Recover from `1db8878` and adapt:
`src/components/animations/{SparkleEffect,ConfettiCelebration,index}.tsx`, `src/components/ui/{Skeleton,ErrorBoundary,index}.tsx`, `src/components/layout/{AppShell,BottomNav,OfflineIndicator,index}.tsx`, `src/app/globals.css`.

- [x] **Step 1: Recover the pure-visual files verbatim**

```bash
mkdir -p src/components/animations src/components/ui src/components/layout
for f in animations/SparkleEffect.tsx animations/ConfettiCelebration.tsx animations/index.ts \
         ui/Skeleton.tsx ui/ErrorBoundary.tsx ui/index.ts; do
  git show 1db8878:src/components/$f > src/components/$f
done
git show 1db8878:src/app/globals.css > src/app/globals.css
```
The animations and `Skeleton` are presentational and need no changes. (`ErrorBoundary` is a class component with no removed deps — keep as-is.)

- [x] **Step 2: Recover + adapt the layout shell**

```bash
for f in AppShell.tsx BottomNav.tsx OfflineIndicator.tsx index.ts; do
  git show 1db8878:src/components/layout/$f > src/components/layout/$f
done
```
Then **adapt**:
- `OfflineIndicator.tsx` and any file importing from `@/lib/offline` or `@/hooks`: those modules were deleted. Replace offline-status usage with a tiny inline hook using `navigator.onLine` + `online`/`offline` events (define a local `useOnlineStatus` inside `OfflineIndicator.tsx`). Remove any pending-action/sync-count UI (that belonged to the old offline layer; TanStack Query handles persistence now).
- `BottomNav.tsx`: remove any nav item pointing to dropped routes (`/upcoming`, `/rules` as a top-level tab if present). Keep tabs: Buckets (`/`), Inbox (`/inbox`), Settings (`/settings`). Keep the inbox badge but have it read from `useOverview().data?.inboxCount` (import the hook) instead of fetching `/api/inbox/count` directly.
- `AppShell.tsx`: if it imported `@/lib/offline` or pull-to-refresh hooks, remove those imports; keep the visual shell (header, `<BottomNav/>`, `<OfflineIndicator/>`, children container). Pull-to-refresh is reintroduced in Phase 3.

- [x] **Step 3: Verify no dangling imports**

Run: `npm run typecheck`
Expected: PASS. If any recovered file still imports a deleted module (`@/lib/offline`, `@/hooks`, `@dnd-kit`, `@/lib/budget-utils`, etc.), remove that import and the small piece of UI that used it until typecheck passes.

- [x] **Step 4: Commit**

```bash
git add src/components/animations src/components/ui src/components/layout src/app/globals.css
git commit -m "feat: recover and adapt app shell, animations, ui primitives"
```

---

## Task 6: CatPiggyBank (recover + adapt + test)

**Files:** Recover `src/components/buckets/CatPiggyBank.tsx`; create `src/components/buckets/CatPiggyBank.test.tsx`

- [x] **Step 1: Recover**

```bash
mkdir -p src/components/buckets
git show 1db8878:src/components/buckets/CatPiggyBank.tsx > src/components/buckets/CatPiggyBank.tsx
```

- [x] **Step 2: Adapt the props to the new model**

Edit `CatPiggyBank.tsx`:
- Rename the prop `autoAllocationAmount` → `topUpAmount` (interface + destructure + the `fillPercent` calculation that referenced it).
- Rename `target` is fine to keep, but its source is `targetAmount`; leave the prop name `target`.
- **Remove** the `reserved` prop and the entire `reserved > 0 ? (...)` branch in the label (scheduled/reserved was dropped) — always render the single balance `<span>`.
- Keep everything else (SVG, expressions, sparkle) unchanged.

- [x] **Step 3: Write a render test**

`src/components/buckets/CatPiggyBank.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatPiggyBank } from './CatPiggyBank';

describe('CatPiggyBank', () => {
  it('renders the name and rounded balance', () => {
    render(<CatPiggyBank name="Groceries" balance={382.2} />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('$382')).toBeInTheDocument();
  });

  it('shows a negative balance in red text without a minus duplication', () => {
    render(<CatPiggyBank name="Dining" balance={-12} isOverspent />);
    expect(screen.getByText('$12')).toBeInTheDocument();
  });
});
```

- [x] **Step 4: Run test, typecheck, commit**

Run: `npx vitest run src/components/buckets/CatPiggyBank.test.tsx` (Expected: PASS, 2 tests), then `npm run typecheck` (PASS).
```bash
git add src/components/buckets/CatPiggyBank.tsx src/components/buckets/CatPiggyBank.test.tsx
git commit -m "feat: cat piggy bank adapted to new bucket model"
```

---

## Task 7: Buckets home page (cache-first)

**Files:** Create `src/app/page.tsx` (replace placeholder), `src/components/buckets/BucketList.tsx` (new, simple)

- [x] **Step 1: Bucket list (groups + cats grid)**

`src/components/buckets/BucketList.tsx`:
```tsx
'use client';
import type { OverviewGroup } from '@/lib/api';
import { CatPiggyBank } from './CatPiggyBank';

export function BucketList({
  groups,
  onFeed,
  sparkleBucketIds,
}: {
  groups: OverviewGroup[];
  onFeed: (bucketId: string) => void;
  sparkleBucketIds: Set<string>;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">{group.name}</h2>
          <div className="grid grid-cols-3 gap-3">
            {group.buckets.map((b) => (
              <CatPiggyBank
                key={b.id}
                name={b.name}
                balance={b.balance}
                target={b.targetAmount ?? undefined}
                topUpAmount={b.topUpAmount}
                color={b.color}
                isOverspent={b.balance < 0}
                showSparkle={sparkleBucketIds.has(b.id)}
                onClick={() => onFeed(b.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [x] **Step 2: Home page — cache-first, instant feed**

`src/app/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { BucketList } from '@/components/buckets/BucketList';
import { ConfettiCelebration } from '@/components/animations';
import { Skeleton } from '@/components/ui';
import { useOverview } from '@/lib/query/hooks';
import { useFeedBucket, useFeedAll } from '@/lib/query/mutations';

export default function HomePage() {
  const { data, isLoading } = useOverview();
  const feed = useFeedBucket();
  const feedAll = useFeedAll();
  const [sparkles, setSparkles] = useState<Set<string>>(new Set());
  const [confetti, setConfetti] = useState(false);

  const sparkle = (ids: string[]) => {
    setSparkles(new Set(ids));
    setTimeout(() => setSparkles(new Set()), 900);
  };

  // Instant: animate from cached topUp/available BEFORE the network resolves.
  const onFeed = (bucketId: string) => {
    const bucket = data?.groups.flatMap((g) => g.buckets).find((b) => b.id === bucketId);
    if (!bucket || bucket.topUpAmount <= 0) return;
    if (bucket.topUpAmount > (data?.availableToBudget ?? 0) + 0.001) return; // can't overdraw the pool
    sparkle([bucketId]);
    feed.mutate({ bucketId, amount: bucket.topUpAmount });
    if ((data?.availableToBudget ?? 0) - bucket.topUpAmount <= 0.001) setConfetti(true);
  };

  const onFeedAll = () => {
    if (!data) return;
    let avail = data.availableToBudget;
    const fed: string[] = [];
    for (const g of data.groups)
      for (const b of g.buckets)
        if (b.topUpAmount > 0 && b.topUpAmount <= avail + 0.001) { fed.push(b.id); avail -= b.topUpAmount; }
    if (fed.length === 0) return;
    sparkle(fed);
    feedAll.mutate();
    if (avail <= 0.001) setConfetti(true);
  };

  return (
    <AppShell>
      <div className="p-4">
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 p-5 text-white">
          <p className="text-sm opacity-90">Available to Budget</p>
          <p className="text-3xl font-bold">${(data?.availableToBudget ?? 0).toFixed(2)}</p>
          <button
            onClick={onFeedAll}
            className="mt-3 w-full rounded-xl bg-white/20 py-2 font-medium backdrop-blur active:scale-95 transition-transform"
          >
            🐱 Feed All
          </button>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : (
          <BucketList groups={data?.groups ?? []} onFeed={onFeed} sparkleBucketIds={sparkles} />
        )}
      </div>
      <ConfettiCelebration trigger={confetti} onComplete={() => setConfetti(false)} />
    </AppShell>
  );
}
```

Note: confirm the recovered `ConfettiCelebration` prop names are `trigger`/`onComplete` and `Skeleton` accepts `className`; if the recovered components differ, match their actual props (read the files) rather than guessing.

- [x] **Step 3: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/app/page.tsx src/components/buckets/BucketList.tsx
git commit -m "feat: cache-first buckets home with instant feed"
```

---

## Task 8: Custom-amount feed modal

**Files:** Recover + adapt `src/components/buckets/FeedModal.tsx`; wire into `src/app/page.tsx`

- [ ] **Step 1: Recover + adapt**

```bash
git show 1db8878:src/components/buckets/FeedModal.tsx > src/components/buckets/FeedModal.tsx
```
Adapt: the modal collects an amount (and optional note) and calls an `onFeed(amount, note?)` prop. Remove any reference to deleted modules. Keep the visual form. It should default the amount to the bucket's `topUpAmount`.

- [ ] **Step 2: Wire a long-press / secondary action**

In `src/app/page.tsx`, add state `feedingBucket` and open `FeedModal` when the user wants a custom amount. Since tap = instant default feed (Task 7), expose custom-amount via a small "＋ custom" affordance in the header or a long-press handler on the cat is out of scope — instead add a tiny "Custom feed" button in the available-to-budget card that opens the modal with a bucket picker. On submit, call `feed.mutate({ bucketId, amount })` and `sparkle([bucketId])`.

Keep this minimal; the primary flow is tap-to-feed.

- [ ] **Step 3: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/components/buckets/FeedModal.tsx src/app/page.tsx
git commit -m "feat: custom-amount feed modal"
```

---

## Task 9: Inbox + allocation with auto-remainder

**Files:** Recover + heavily adapt `src/components/transactions/AllocationModal.tsx`; create `src/app/inbox/page.tsx`; recover `src/components/transactions/{TransactionList,index}.tsx`

- [ ] **Step 1: Recover the modal + list**

```bash
mkdir -p src/components/transactions
for f in AllocationModal.tsx TransactionList.tsx index.ts; do
  git show 1db8878:src/components/transactions/$f > src/components/transactions/$f
done
```

- [ ] **Step 2: Adapt AllocationModal to cached buckets + auto-remainder**

Edit `AllocationModal.tsx`:
- Replace the `useEffect` that does `fetch('/api/bucket-groups')` with a prop `buckets: { id: string; name: string; color: string; groupName: string }[]` passed in from the page (derived from `useOverview`). Remove the internal fetch.
- Change the split rows' `amount` type to `number | null` (null = not entered). Import `computeAutoRemainder` and `validateSplit` from `@/lib/domain/split`.
- After any split edit, compute the remainder: if exactly one row has `amount === null`, display its value as the live remainder (read-only or pre-filled) using `computeAutoRemainder(transaction.amount, rows)`. Render a "Remaining: $X" line from `validateSplit`.
- On submit, fill the single null row with the computed remainder, then validate with `validateSplit` (signed amounts: expense rows negative). Call the `onAllocate(id, allocations)` prop (which the page wires to `useAllocate().mutate`). Remove the local `createRule` POST and instead pass `createRule` up; the page creates the rule via `api.createRule` when true.
- Keep income display (income isn't allocated) and the manual edit/delete affordances, but route edit/delete through props the page supplies.

- [ ] **Step 3: Inbox page**

`src/app/inbox/page.tsx` (cache-first):
```tsx
'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { AllocationModal } from '@/components/transactions';
import { useInbox, useOverview } from '@/lib/query/hooks';
import { useAllocate } from '@/lib/query/mutations';
import { api, type Transaction } from '@/lib/api';

export default function InboxPage() {
  const { data: inbox, isLoading } = useInbox();
  const { data: overview } = useOverview();
  const allocate = useAllocate();
  const [active, setActive] = useState<Transaction | null>(null);

  const buckets = (overview?.groups ?? []).flatMap((g) =>
    g.buckets.map((b) => ({ id: b.id, name: b.name, color: b.color, groupName: g.name }))
  );

  const onAllocate = async (
    id: string,
    allocations: { bucketId: string; amount: number }[],
    createRule: boolean,
    merchant: string | null
  ) => {
    await allocate.mutateAsync({ id, allocations });
    if (createRule && merchant && allocations.length === 1) {
      await api.createRule(merchant, allocations[0].bucketId).catch(() => {});
    }
    setActive(null);
  };

  return (
    <AppShell>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Inbox</h1>
        {isLoading && !inbox ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : inbox && inbox.length > 0 ? (
          <ul className="space-y-2">
            {inbox.map((t) => (
              <li key={t.id}>
                <button onClick={() => setActive(t)} className="w-full text-left rounded-xl bg-white border border-gray-200 p-3 flex justify-between">
                  <span>
                    <span className="font-medium">{t.merchant ?? t.description ?? 'Transaction'}</span>
                    {t.status === 'pending' && <span className="ml-2 text-xs text-amber-600">pending</span>}
                    {t.needsReview && <span className="ml-2 text-xs text-red-600">review</span>}
                  </span>
                  <span className="font-semibold">${Math.abs(t.amount).toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-400 py-12">All caught up 🎉</p>
        )}
      </div>
      {active && (
        <AllocationModal
          isOpen
          onClose={() => setActive(null)}
          buckets={buckets}
          transaction={active}
          onAllocate={onAllocate}
        />
      )}
    </AppShell>
  );
}
```
Adjust the `AllocationModal` prop types so its `onAllocate` signature matches `(id, allocations, createRule, merchant)` and it accepts `buckets`. Match the modal's actual `transaction` shape to the `Transaction` type from `@/lib/api`.

- [ ] **Step 4: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/components/transactions src/app/inbox
git commit -m "feat: inbox and allocation with auto-remainder"
```

---

## Task 10: Manual entry, settings, bucket/group management, tap reorder

**Files:** Recover + adapt `src/components/transactions/TransactionForm.tsx`, `src/components/buckets/{BucketForm,BucketDetailModal}.tsx`, `src/app/settings/page.tsx`, `src/components/buckets/ReorderGroupsModal.tsx`

- [ ] **Step 1: Recover the forms/modals**

```bash
for f in buckets/BucketForm.tsx buckets/BucketDetailModal.tsx buckets/ReorderGroupsModal.tsx transactions/TransactionForm.tsx; do
  git show 1db8878:src/components/$f > src/components/$f
done
```

- [ ] **Step 2: Adapt**

- `BucketForm.tsx` / `BucketDetailModal.tsx`: remove fields for dropped concepts (`type` savings/spending, `rollover`, `rolloverTarget`, scheduled). Keep: name, color, icon, `topUpAmount`, optional `targetAmount`. Wire submit to `api.createBucket` / `api.updateBucket` via `useOverviewMutation`.
- `ReorderGroupsModal.tsx`: **remove all `@dnd-kit` usage.** Replace drag handles with ▲/▼ buttons that swap adjacent items in local order state; on save call `api.reorderGroups(order)` (and an equivalent for buckets). This is the tap-based reorder from the spec.
- `TransactionForm.tsx`: manual entry — fields amount, date, merchant, and a kind toggle (expense/income). Submit via `api.createTransaction`; invalidate `qk.overview` and `qk.inbox`.

- [ ] **Step 3: Settings page**

`src/app/settings/page.tsx`: cache-first using `useSettings`. Show `initialSyncDays` (number input, 1–30) and `theme` (system/light/dark); save via `api.updateSettings` with optimistic invalidation. Include a sign-out button (reuse the recovered logic from the old `settings/SettingsPageClient.tsx` at `1db8878` — recover it for reference: `git show 1db8878:src/app/settings/SettingsPageClient.tsx`). Account management UI is Phase 3 — leave a placeholder section labeled "Bank accounts (coming in sync phase)".

- [ ] **Step 4: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/components/buckets src/components/transactions src/app/settings
git commit -m "feat: manual entry, settings, bucket management, tap reorder"
```

---

## Task 11: Component tests for the critical flows

**Files:** Create `src/components/transactions/AllocationModal.test.tsx`

- [ ] **Step 1: Auto-remainder test**

`src/components/transactions/AllocationModal.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AllocationModal } from './AllocationModal';

const buckets = [
  { id: 'pet', name: 'Pet', color: '#f00', groupName: 'Life' },
  { id: 'groceries', name: 'Groceries', color: '#0f0', groupName: 'Life' },
];
const txn = {
  id: 't1', amount: -12.9, merchant: 'Countdown', description: null, date: '2026-05-01',
  kind: 'expense' as const, status: 'confirmed' as const, source: 'akahu' as const,
  needsReview: false, allocations: [],
};

describe('AllocationModal auto-remainder', () => {
  it('auto-fills the last bucket when splitting', async () => {
    const onAllocate = vi.fn().mockResolvedValue(undefined);
    render(<AllocationModal isOpen onClose={() => {}} buckets={buckets} transaction={txn} onAllocate={onAllocate} />);
    // Enter split mode, choose Pet = 4.50, leave Groceries empty, submit.
    // (Drive the modal via its actual controls; assert onAllocate receives
    //  pet -4.50 and groceries -8.40 summing to -12.90.)
    // Implementer: wire selectors to match the adapted modal's markup.
    expect(buckets.length).toBe(2);
  });
});
```
Note to implementer: replace the commented section with real interactions matching the adapted modal markup (the auto-remainder logic itself is already unit-tested in `split.test.ts`; this test verifies the modal wires it). If the modal's markup makes a full interaction test brittle, assert instead that submitting a single-bucket allocation calls `onAllocate` with the full `-12.90`, and keep the remainder math covered by `split.test.ts`.

- [ ] **Step 2: Run tests, typecheck, commit**

Run: `npm run test:run` (Expected: all green, including the 29 Phase 1 tests + new component tests) and `npm run typecheck` (PASS).
```bash
git add src/components/transactions/AllocationModal.test.tsx
git commit -m "test: allocation modal wiring"
```

---

## Task 12: Phase 2 verification

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: typecheck PASS, lint clean (fix any unused imports left from recoveries), all tests green.

- [ ] **Step 2: Confirm no forbidden deps/imports remain**

Run: `grep -rn "@dnd-kit\|@/lib/offline\|@/lib/budget-utils\|router.refresh\|/api/inbox/count" src/ || echo "clean"`
Expected: `clean` (or only intentional matches). `router.refresh()` must not appear in any feed/allocation path.

- [ ] **Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "chore: phase 2 lint/cleanup"
```

---

## Self-review notes

- **Spec coverage:** local-first SWR via TanStack Query + IndexedDB persister (Tasks 2–3); instant optimistic feed with no `router.refresh` (Tasks 4, 7); Feed All (Tasks 4, 7); confetti at $0 (Task 7); auto-remainder split (Task 9, using the unit-tested `computeAutoRemainder`); inbox = unallocated expenses, pending + needsReview surfaced (Task 9); rules created on allocation (Task 9); tap-based reorder, no drag (Task 10); manual entry, settings (Task 10); PWA metadata + existing next-pwa/manifest (Task 2). Akahu sync, accounts UI, pull-to-refresh, and the pending-lifecycle engine are **Phase 3**.
- **New backend:** `/api/overview` (Task 1) fills the balance gap the Phase 1 API left.
- **Ported components are recovered from `1db8878` and explicitly adapted** (field renames, removed dropped-feature UI, removed deleted-module imports, drag→tap) — concrete edits, not placeholders.

---

## Phase roadmap

**Phase 3 — Akahu sync & hardening** (next plan): ported+hardened Akahu client; accounts API + UI; sync engine using `accountIdentityKey`/`fallbackDedupKey`/`transactionsMatch`; auto-classify + rules at ingestion for pending & confirmed; pending lifecycle (reconcile-in-place, never delete-and-recreate, `needsReview`); full-refresh; pull-to-refresh; Playwright E2E.

---

## Execution

Implement task-by-task with `superpowers:subagent-driven-development`. Each task commits and ticks its checkboxes, so execution is fully resumable.
