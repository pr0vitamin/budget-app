# Cat Budget Rebuild — Phase 3: Akahu sync & hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the durable ledger to Akahu with a sync engine that can never destroy data: stable account identity, robust dedup, and a pending→confirmed lifecycle that preserves allocations.

**Architecture:** A thin Akahu client + **pure, unit-tested reconciliation logic** (`src/lib/domain/reconcile.ts`) that decides create/update/confirm and how to treat allocations when an amount changes. A sync orchestrator wires Akahu → reconcile → classify → rules into Prisma. Accounts resolve by stable account number so reconnection updates rather than duplicates; deletion never cascades (schema is already `SetNull`). Pull-to-refresh triggers sync from the client; TanStack Query revalidates after.

**Tech Stack:** Next.js 16 route handlers, Prisma 7 / Postgres, Akahu personal-app API, Vitest, Playwright. Reuses Phase 1 domain helpers (`classify`, `rules`, `dedup`).

---

## Conventions for the executor

- **Recover old code** from git commit `1db8878`: `git show 1db8878:<path> > <path>` (mkdir -p first), then adapt. Do NOT recover the old `sync-transactions.ts`/`sync-pending.ts` logic verbatim — those held the bugs; the engine is rewritten here. The old `akahu.ts` client is fine to recover.
- **Prisma:** `import { prisma } from '@/lib/db'`. **Auth:** `getAuthedUserId()` from `@/lib/auth`.
- **Reuse Phase 1 domain helpers:** `transactionsMatch`, `accountIdentityKey`, `fallbackDedupKey` (`@/lib/domain/dedup`), `classifyKind` (`@/lib/domain/classify`), `findMatchingRule`, `normalizePattern` (`@/lib/domain/rules`).
- **Money:** signed `Decimal`; coerce with `Number(...)`. Amounts negative = outflow.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commit per task; tick `- [ ]`→`- [x]` after each and commit `docs: tick Phase 3 Task N checkboxes`.
- **Gates:** `npm run typecheck` + `npm run test:run` after each task. Akahu calls need real env (`AKAHU_APP_TOKEN`, `AKAHU_USER_TOKEN`); they are NOT exercised by unit tests — the engine's correctness lives in the pure reconcile tests.
- A local Postgres + `AUTH_DEV_BYPASS=true` dev setup already exists (see `docs/LOCAL_DEV.md`).

---

## File structure (Phase 3)

| File | Responsibility |
| --- | --- |
| `src/lib/akahu.ts` | Akahu HTTP client (recovered) |
| `src/lib/domain/reconcile.ts` | PURE: decide create/update/confirm + allocation reconciliation |
| `src/lib/sync/engine.ts` | Orchestrates Akahu → reconcile → classify → rules → Prisma |
| `src/app/api/accounts/route.ts` | GET list, POST sync-accounts-from-Akahu (identity resolution) |
| `src/app/api/accounts/[id]/route.ts` | DELETE (unlink, never cascade) |
| `src/app/api/accounts/[id]/refresh/route.ts` | Trigger Akahu refresh for one account |
| `src/app/api/transactions/sync/route.ts` | POST: run the sync engine (incremental or full) |
| `src/lib/api.ts` | + `syncTransactions`, `getAccounts`, `connectAccounts`, `removeAccount` |
| `src/hooks/usePullToRefresh.ts` | Pull-to-refresh gesture (recovered) |
| `src/components/accounts/AccountsList.tsx` | Accounts UI (recovered + adapted) |
| `e2e/*.spec.ts` | Playwright flows (local, via AUTH_DEV_BYPASS) |

---

## Task 1: Akahu client (recover)

**Files:** Recover `src/lib/akahu.ts`

- [ ] **Step 1: Recover and sanity-check**

```bash
mkdir -p src/lib
git show 1db8878:src/lib/akahu.ts > src/lib/akahu.ts
```
Read it. It uses `AKAHU_APP_TOKEN` + `AKAHU_USER_TOKEN` (personal-app auth) and exposes `getAccounts`, `getTransactions(accountId, start?, end?)`, `getPendingTransactions`, `refreshAccountAndWait`, and the `AkahuAccount` / `AkahuTransaction` / `AkahuPendingTransaction` types. It has no imports of deleted modules. Make no behavioural changes; only fix imports/types if `npm run typecheck` complains.

- [ ] **Step 2: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/lib/akahu.ts
git commit -m "feat: recover akahu client"
```

---

## Task 2: Reconciliation logic (pure, TDD)

**Files:** Create `src/lib/domain/reconcile.ts`, `src/lib/domain/reconcile.test.ts`

This is the heart of the data-loss fix. Pure functions, fully tested.

- [ ] **Step 1: Write the failing test**

`src/lib/domain/reconcile.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { decideSyncAction, reconcileAllocations, type ExistingTxn } from './reconcile';

const base = (over: Partial<ExistingTxn>): ExistingTxn => ({
  id: 'x',
  externalId: null,
  hash: null,
  status: 'confirmed',
  date: new Date('2026-05-01'),
  amount: -10,
  description: 'Countdown',
  allocationCount: 0,
  ...over,
});

describe('decideSyncAction', () => {
  it('creates when nothing matches', () => {
    expect(
      decideSyncAction({ externalId: 'a1', hash: 'h1', date: new Date('2026-05-01'), amount: -10, description: 'New' }, [])
    ).toEqual({ type: 'create' });
  });

  it('updates an already-confirmed txn matched by externalId', () => {
    const existing = [base({ id: 'e1', externalId: 'a1', status: 'confirmed' })];
    expect(
      decideSyncAction({ externalId: 'a1', hash: null, date: new Date('2026-05-01'), amount: -10, description: 'Countdown' }, existing)
    ).toEqual({ type: 'update', id: 'e1' });
  });

  it('absorbs an Akahu-reissued id by matching the stable hash', () => {
    const existing = [base({ id: 'e1', externalId: 'OLD', hash: 'h1', status: 'confirmed' })];
    expect(
      decideSyncAction({ externalId: 'NEW', hash: 'h1', date: new Date('2026-05-01'), amount: -10, description: 'Countdown' }, existing)
    ).toEqual({ type: 'update', id: 'e1' });
  });

  it('confirms a fuzzily-matched pending transaction', () => {
    // pending $1 pre-auth settles to $1.05, same day/desc, no ids on pending
    const existing = [base({ id: 'p1', status: 'pending', amount: -1, description: 'Cafe Hold' })];
    expect(
      decideSyncAction({ externalId: 'a9', hash: 'h9', date: new Date('2026-05-01'), amount: -1.05, description: 'Cafe Hold' }, existing)
    ).toEqual({ type: 'confirm', id: 'p1' });
  });

  it('confirms (not updates) when an id match is still pending', () => {
    const existing = [base({ id: 'p2', externalId: 'a1', status: 'pending' })];
    expect(
      decideSyncAction({ externalId: 'a1', hash: null, date: new Date('2026-05-01'), amount: -10, description: 'Countdown' }, existing)
    ).toEqual({ type: 'confirm', id: 'p2' });
  });
});

describe('reconcileAllocations', () => {
  it('does nothing when there are no allocations', () => {
    expect(reconcileAllocations({ allocationCount: 0, allocationSum: 0, newAmount: -10 })).toEqual({ type: 'none' });
  });

  it('does nothing when allocations still sum to the new amount', () => {
    expect(reconcileAllocations({ allocationCount: 2, allocationSum: -10, newAmount: -10 })).toEqual({ type: 'none' });
  });

  it('rescales a single allocation to the new amount', () => {
    expect(reconcileAllocations({ allocationCount: 1, allocationSum: -10, newAmount: -12.5 })).toEqual({
      type: 'updateSingle',
      amount: -12.5,
    });
  });

  it('flags a split for review when it no longer balances (never deletes)', () => {
    expect(reconcileAllocations({ allocationCount: 2, allocationSum: -10, newAmount: -14 })).toEqual({ type: 'flagReview' });
  });
});
```

- [ ] **Step 2: Run it — expect failure (module missing).**

Run: `npx vitest run src/lib/domain/reconcile.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/domain/reconcile.ts`:
```typescript
import { transactionsMatch } from './dedup';

export interface ExistingTxn {
  id: string;
  externalId: string | null;
  hash: string | null;
  status: 'pending' | 'confirmed';
  date: Date;
  amount: number;
  description: string | null;
  allocationCount: number;
}

export interface IncomingTxn {
  externalId: string | null;
  hash: string | null;
  date: Date;
  amount: number;
  description: string | null;
}

export type SyncAction =
  | { type: 'create' }
  | { type: 'update'; id: string } // same already-confirmed txn → refresh fields
  | { type: 'confirm'; id: string }; // a pending row becomes confirmed in place

/**
 * Decide how an incoming Akahu transaction maps to existing local rows.
 * Priority: exact externalId, then stable Akahu hash (absorbs reissued ids),
 * then a fuzzy match against a pending row. Never returns "delete".
 */
export function decideSyncAction(incoming: IncomingTxn, existing: ExistingTxn[]): SyncAction {
  const matchById = incoming.externalId
    ? existing.find((e) => e.externalId && e.externalId === incoming.externalId)
    : undefined;
  if (matchById) return matchById.status === 'pending' ? { type: 'confirm', id: matchById.id } : { type: 'update', id: matchById.id };

  const matchByHash = incoming.hash ? existing.find((e) => e.hash && e.hash === incoming.hash) : undefined;
  if (matchByHash) return matchByHash.status === 'pending' ? { type: 'confirm', id: matchByHash.id } : { type: 'update', id: matchByHash.id };

  const pending = existing.find((e) => e.status === 'pending' && transactionsMatch(incoming, e));
  if (pending) return { type: 'confirm', id: pending.id };

  return { type: 'create' };
}

export type AllocationReconcile =
  | { type: 'none' }
  | { type: 'updateSingle'; amount: number }
  | { type: 'flagReview' };

/**
 * When a transaction's amount changes (pending→confirmed or amended), decide
 * what to do with existing allocations WITHOUT ever deleting them:
 * - none: no allocations, or they still balance
 * - updateSingle: a single allocation → rescale it to the new amount
 * - flagReview: a split that no longer balances → keep it, set needsReview
 */
export function reconcileAllocations(input: {
  allocationCount: number;
  allocationSum: number;
  newAmount: number;
}): AllocationReconcile {
  const { allocationCount, allocationSum, newAmount } = input;
  if (allocationCount === 0) return { type: 'none' };
  if (Math.abs(allocationSum - newAmount) < 0.01) return { type: 'none' };
  if (allocationCount === 1) return { type: 'updateSingle', amount: newAmount };
  return { type: 'flagReview' };
}
```

- [ ] **Step 4: Run it — expect pass (9 tests).**

Run: `npx vitest run src/lib/domain/reconcile.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/reconcile.ts src/lib/domain/reconcile.test.ts
git commit -m "feat: pure sync reconciliation logic (create/update/confirm + allocations)"
```

---

## Task 3: Accounts API (identity resolution, no cascade)

**Files:** Create `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`, `src/app/api/accounts/[id]/refresh/route.ts`

- [ ] **Step 1: List + connect/sync accounts**

`src/app/api/accounts/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { getAccounts as getAkahuAccounts } from '@/lib/akahu';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(accounts);
}

// POST: pull accounts from Akahu and upsert by STABLE identity (account number
// if present, else akahuId) so reconnection updates the same row, never dupes.
export async function POST() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let akahuAccounts;
  try {
    akahuAccounts = await getAkahuAccounts();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Akahu error' }, { status: 502 });
  }

  const existing = await prisma.account.findMany({ where: { userId } });

  for (const a of akahuAccounts) {
    const accountNumber = a.formatted_account ?? null;
    const fields = {
      akahuId: a._id,
      accountNumber,
      name: a.name,
      institution: a.connection.name,
      accountType: a.type.toLowerCase(),
      balanceCurrent: a.balance?.current ?? null,
      balanceAvailable: a.balance?.available ?? null,
      currency: a.balance?.currency ?? 'NZD',
      status: a.status,
      connectionLogo: a.connection.logo ?? null,
    };

    // Resolve to an existing row by stable identity.
    const match = existing.find((e) =>
      accountNumber ? e.accountNumber === accountNumber : e.akahuId === a._id
    );

    if (match) {
      await prisma.account.update({ where: { id: match.id }, data: fields });
    } else {
      await prisma.account.create({ data: { userId, ...fields } });
    }
  }

  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ count: accounts.length, accounts });
}
```

- [ ] **Step 2: Delete (unlink, never cascade)**

`src/app/api/accounts/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Deleting an account NEVER deletes transactions — the schema's onDelete:
// SetNull keeps the durable ledger intact (the income-loss fix).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.account.delete({ where: { id } }); // transactions.accountId → null (SetNull)
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Refresh one account**

`src/app/api/accounts/[id]/refresh/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { refreshAccountAndWait } from '@/lib/akahu';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await refreshAccountAndWait(account.akahuId);
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Typecheck & commit**

Run: `npm run typecheck` (PASS).
```bash
git add src/app/api/accounts
git commit -m "feat: accounts API with stable identity and non-destructive delete"
```

---

## Task 4: Sync engine + endpoint

**Files:** Create `src/lib/sync/engine.ts`, `src/app/api/transactions/sync/route.ts`

The orchestrator. It is not unit-tested (DB-bound); its decisions come from the Task-2 pure functions, which are.

- [ ] **Step 1: Sync engine**

`src/lib/sync/engine.ts`:
```typescript
import { prisma } from '@/lib/db';
import { getTransactions, getPendingTransactions, type AkahuTransaction } from '@/lib/akahu';
import { decideSyncAction, reconcileAllocations, type ExistingTxn } from '@/lib/domain/reconcile';
import { classifyKind } from '@/lib/domain/classify';
import { findMatchingRule, type Rule } from '@/lib/domain/rules';

export interface SyncResult { created: number; updated: number; confirmed: number; flaggedReview: number; }

function merchantOf(t: { merchant?: { name: string }; description: string }): string {
  return t.merchant?.name ?? t.description.replace(/\s+/g, ' ').trim().slice(0, 100);
}

// Apply categorization rules to a freshly-ingested EXPENSE that has no allocation.
async function autoCategorize(txnId: string, merchant: string, amount: number, rules: Rule[]): Promise<void> {
  if (amount >= 0) return; // only expenses
  const rule = findMatchingRule(merchant, rules);
  if (!rule) return;
  await prisma.allocation.create({ data: { transactionId: txnId, bucketId: rule.bucketId, amount } });
}

export async function syncUser(
  userId: string,
  opts: { windowDays?: number } = {}
): Promise<SyncResult> {
  const windowDays = opts.windowDays ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const accounts = await prisma.account.findMany({ where: { userId } });
  if (accounts.length === 0) return { created: 0, updated: 0, confirmed: 0, flaggedReview: 0 };
  const akahuToLocal = new Map(accounts.map((a) => [a.akahuId, a.id]));

  const rules = (await prisma.categorizationRule.findMany({ where: { userId } })).map((r) => ({
    id: r.id, merchantPattern: r.merchantPattern, bucketId: r.bucketId,
  }));

  // Candidate existing rows for matching: this user's pending rows + recent rows.
  const existingRows = await prisma.transaction.findMany({
    where: { userId, OR: [{ status: 'pending' }, { date: { gte: since } }] },
    include: { allocations: { select: { amount: true } } },
  });
  const existing: (ExistingTxn & { accountId: string | null })[] = existingRows.map((t) => ({
    id: t.id,
    externalId: t.externalId,
    hash: t.hash,
    status: t.status as 'pending' | 'confirmed',
    date: t.date,
    amount: Number(t.amount),
    description: t.description,
    allocationCount: t.allocations.length,
    accountId: t.accountId,
  }));

  const result: SyncResult = { created: 0, updated: 0, confirmed: 0, flaggedReview: 0 };

  for (const account of accounts) {
    let akahuTxns: AkahuTransaction[] = [];
    try {
      akahuTxns = await getTransactions(account.akahuId, since.toISOString().split('T')[0]);
    } catch (e) {
      console.error(`Sync failed for account ${account.id}:`, e);
      continue; // graceful: keep other accounts working
    }

    for (const at of akahuTxns) {
      const incoming = {
        externalId: at._id,
        hash: at.hash ?? null,
        date: new Date(at.date),
        amount: at.amount,
        description: at.description,
      };
      const action = decideSyncAction(incoming, existing);
      const kind = classifyKind({ type: at.type, amount: at.amount });
      const merchant = merchantOf(at);

      if (action.type === 'create') {
        const created = await prisma.transaction.create({
          data: {
            userId, accountId: account.id, source: 'akahu', externalId: at._id, hash: at.hash ?? null,
            kind, amount: at.amount, merchant, description: at.description,
            date: incoming.date, category: at.category?.name ?? null,
            balanceAfter: at.balance ?? null, status: 'confirmed',
          },
        });
        await autoCategorize(created.id, merchant, at.amount, rules);
        existing.push({ id: created.id, externalId: at._id, hash: at.hash ?? null, status: 'confirmed', date: incoming.date, amount: at.amount, description: at.description, allocationCount: 0, accountId: account.id });
        result.created++;
      } else {
        // update or confirm — reconcile allocations against the new amount
        const target = existingRows.find((e) => e.id === action.id)!;
        const allocSum = target.allocations.reduce((s, a) => s + Number(a.amount), 0);
        const recon = reconcileAllocations({ allocationCount: target.allocations.length, allocationSum: allocSum, newAmount: at.amount });

        if (recon.type === 'updateSingle') {
          await prisma.allocation.updateMany({ where: { transactionId: target.id }, data: { amount: recon.amount } });
        }
        await prisma.transaction.update({
          where: { id: target.id },
          data: {
            externalId: at._id, hash: at.hash ?? null, amount: at.amount, merchant,
            description: at.description, category: at.category?.name ?? null,
            balanceAfter: at.balance ?? null, status: 'confirmed',
            needsReview: recon.type === 'flagReview' ? true : undefined,
            // keep user's kind override
            kind: undefined,
          },
        });
        // newly-confirmed expense with no allocation → try rules
        if (target.allocations.length === 0) await autoCategorize(target.id, merchant, at.amount, rules);
        if (recon.type === 'flagReview') result.flaggedReview++;
        if (action.type === 'confirm') result.confirmed++; else result.updated++;
      }
    }
  }

  // Pending transactions: upsert in place; drop disappeared ones only if no allocations.
  await syncPending(userId, akahuToLocal, rules, result);
  return result;
}

async function syncPending(
  userId: string,
  akahuToLocal: Map<string, string>,
  rules: Rule[],
  result: SyncResult
): Promise<void> {
  let pending: Awaited<ReturnType<typeof getPendingTransactions>> = [];
  try {
    pending = await getPendingTransactions();
  } catch {
    return; // pending is best-effort
  }
  const mine = pending.filter((p) => akahuToLocal.has(p._account));

  const localPending = await prisma.transaction.findMany({
    where: { userId, status: 'pending' },
    include: { allocations: { select: { id: true } } },
  });

  const seen = new Set<string>();
  for (const p of mine) {
    const accountId = akahuToLocal.get(p._account)!;
    const incoming = { externalId: null, hash: null, date: new Date(p.date), amount: p.amount, description: p.description };
    // Match an existing local pending row to update IN PLACE (never delete+recreate).
    const match = localPending.find(
      (lp) => !seen.has(lp.id) && lp.accountId === accountId &&
        Math.abs(Number(lp.amount) - p.amount) <= Math.max(Math.abs(p.amount) * 0.3, 0.05) &&
        Math.abs(new Date(lp.date).getTime() - new Date(p.date).getTime()) <= 5 * 86400000
    );
    if (match) {
      seen.add(match.id);
      await prisma.transaction.update({
        where: { id: match.id },
        data: { amount: p.amount, description: p.description, date: incoming.date },
      });
    } else {
      const kind = classifyKind({ type: p.type, amount: p.amount });
      const merchant = p.description.replace(/\s+/g, ' ').trim().slice(0, 100);
      const created = await prisma.transaction.create({
        data: { userId, accountId, source: 'akahu', kind, amount: p.amount, merchant, description: p.description, date: incoming.date, status: 'pending' },
      });
      await autoCategorizePending(created.id, merchant, p.amount, rules);
      result.created++;
    }
  }

  // Disappeared pending (no longer reported, not matched): drop only if allocation-free.
  for (const lp of localPending) {
    if (seen.has(lp.id)) continue;
    if (lp.allocations.length === 0) {
      await prisma.transaction.delete({ where: { id: lp.id } });
    } else {
      await prisma.transaction.update({ where: { id: lp.id }, data: { needsReview: true } });
      result.flaggedReview++;
    }
  }
}

async function autoCategorizePending(txnId: string, merchant: string, amount: number, rules: Rule[]): Promise<void> {
  if (amount >= 0) return;
  const rule = findMatchingRule(merchant, rules);
  if (rule) await prisma.allocation.create({ data: { transactionId: txnId, bucketId: rule.bucketId, amount } });
}
```

- [ ] **Step 2: Sync endpoint**

`src/app/api/transactions/sync/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth';
import { syncUser } from '@/lib/sync/engine';

// POST /api/transactions/sync  body: { full?: boolean }
// full = wider window to self-heal historical gaps.
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let full = false;
  try { full = (await request.json())?.full === true; } catch { /* no body */ }

  try {
    const result = await syncUser(userId, { windowDays: full ? 365 : 14 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Typecheck & commit**

Run: `npm run typecheck` (PASS).
```bash
git add src/lib/sync src/app/api/transactions/sync
git commit -m "feat: sync engine — dedup, classify, rules-on-ingest, pending lifecycle"
```

---

## Task 5: Client wiring — api + hooks + pull-to-refresh

**Files:** Modify `src/lib/api.ts`, `src/lib/query/hooks.ts`; recover `src/hooks/usePullToRefresh.ts`; modify `src/app/page.tsx` and `src/app/transactions/page.tsx`

- [ ] **Step 1: API + accounts hook**

Add to `src/lib/api.ts` (inside the `api` object) and the `Account` type:
```typescript
// type
export interface Account {
  id: string; name: string; institution: string; accountType: string;
  accountNumber: string | null; balanceCurrent: number | null; balanceAvailable: number | null;
  currency: string; status: string; connectionLogo: string | null; lastSyncAt: string | null; connectionError: string | null;
}
// api members:
  accounts: () => http<Account[]>('/api/accounts'),
  connectAccounts: () => http<{ count: number }>('/api/accounts', { method: 'POST' }),
  removeAccount: (id: string) => http(`/api/accounts/${id}`, { method: 'DELETE' }),
  refreshAccount: (id: string) => http(`/api/accounts/${id}/refresh`, { method: 'POST' }),
  sync: (full = false) => http<{ created: number; updated: number; confirmed: number; flaggedReview: number }>('/api/transactions/sync', { method: 'POST', body: JSON.stringify({ full }) }),
```
Add to `src/lib/query/hooks.ts`:
```typescript
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: api.accounts });
```

- [ ] **Step 2: Recover pull-to-refresh**

```bash
mkdir -p src/hooks
git show 1db8878:src/hooks/usePullToRefresh.ts > src/hooks/usePullToRefresh.ts
```
Read it; remove any deleted-module imports. It should expose a hook taking an async `onRefresh` callback. If its API differs, adapt the call sites in Step 3 to match.

- [ ] **Step 3: Wire sync into the Cats and Transactions pages**

In both `src/app/page.tsx` and `src/app/transactions/page.tsx`, add a sync handler and pull-to-refresh:
```typescript
import { useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
// inside component:
const qc = useQueryClient();
const onRefresh = async () => {
  try { await api.sync(); } catch { /* surfaced via banner elsewhere */ }
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.overview }),
    qc.invalidateQueries({ queryKey: qk.transactions('all') }),
  ]);
};
usePullToRefresh(onRefresh);
```
(The Transactions page already has `qc`; reuse it. Match `usePullToRefresh`'s actual signature.)

- [ ] **Step 4: Typecheck & commit**

Run: `npm run typecheck` (PASS).
```bash
git add src/lib/api.ts src/lib/query/hooks.ts src/hooks/usePullToRefresh.ts src/app/page.tsx src/app/transactions/page.tsx
git commit -m "feat: pull-to-refresh sync + accounts api/hooks"
```

---

## Task 6: Accounts UI in Settings

**Files:** Recover `src/components/accounts/AccountsList.tsx` (+ `index.ts`); modify `src/app/settings/page.tsx`

- [ ] **Step 1: Recover + adapt**

```bash
mkdir -p src/components/accounts
git show 1db8878:src/components/accounts/AccountsList.tsx > src/components/accounts/AccountsList.tsx
git show 1db8878:src/components/accounts/index.ts > src/components/accounts/index.ts
```
Adapt: remove deleted-module imports; drive data from `useAccounts()` and actions from `api.connectAccounts` / `api.removeAccount` / `api.refreshAccount` (invalidate `['accounts']` and `qk.overview` after). Show each account's name, institution, balance, `lastSyncAt`, and `connectionError` if present. Provide a "Connect / sync accounts" button (calls `connectAccounts`) and a per-account remove (with a confirm noting transactions are kept).

- [ ] **Step 2: Replace the Settings placeholder**

In `src/app/settings/page.tsx`, replace the "Bank accounts (coming in sync phase)" placeholder with `<AccountsList />`, plus a **"Sync now"** button calling `api.sync()` and a **"Full refresh"** button calling `api.sync(true)`, each invalidating `qk.overview` + `qk.transactions('all')` and showing the returned counts (created/confirmed/flaggedReview) in a small toast/line.

- [ ] **Step 3: Typecheck & commit**

Run: `npm run typecheck` (PASS).
```bash
git add src/components/accounts src/app/settings/page.tsx
git commit -m "feat: accounts UI + sync controls in settings"
```

---

## Task 7: E2E smoke tests (local, via auth bypass)

**Files:** Modify `playwright.config.ts`; create `e2e/budget-flows.spec.ts`; review `e2e/global-setup.ts`

Akahu isn't exercised in E2E (needs live creds); the engine is covered by `reconcile.test.ts`. These verify the local user flows end-to-end against local Postgres with `AUTH_DEV_BYPASS`.

- [ ] **Step 1: Configure Playwright to run the app with the bypass**

In `playwright.config.ts`, ensure a `webServer` block starts the app with the bypass and points at local Postgres:
```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  env: { AUTH_DEV_BYPASS: 'true' },
},
use: { baseURL: 'http://localhost:3000' },
```
If `e2e/global-setup.ts` does Supabase auth, make it a no-op when `AUTH_DEV_BYPASS=true` (the bypass means no login needed). Remove obsolete specs that target dropped features (`e2e/inbox.spec.ts`, `e2e/buckets.spec.ts`, `e2e/settings.spec.ts`, `e2e/navigation.spec.ts`) if they reference the old UI; replace with the flow spec below.

- [ ] **Step 2: Core flow spec**

`e2e/budget-flows.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('create clowder + cat, add income, feed, allocate an expense', async ({ page }) => {
  await page.goto('/');

  // Manage → new Clowder
  await page.getByRole('button', { name: /Manage/i }).click();
  await page.getByRole('button', { name: /New Clowder/i }).click();
  await page.getByPlaceholder(/Bills, Fun, Savings/i).fill('Life');
  await page.getByRole('button', { name: /^Create$/ }).click();

  // Add a cat with a top-up
  await page.getByRole('button', { name: /＋ Cat|Cat$/ }).first().click();
  // (Fill the BucketForm fields by their labels/placeholders as implemented.)
  // ... name "Groceries", topUp 50 ... submit.

  // Leave manage mode
  await page.getByRole('button', { name: /Done/i }).click();

  // Add income on the Transactions page
  await page.goto('/transactions');
  await page.getByRole('button', { name: /Add transaction/i }).click();
  // ... fill amount 200, kind income ... submit.

  // Feed the cat, then expect its balance to reflect the top-up.
  await page.goto('/');
  await page.getByRole('button', { name: /Feed/i }).first().click();
  await page.getByRole('button', { name: /Feed/i }).last().click(); // confirm in modal
  await expect(page.getByText('Groceries')).toBeVisible();
});
```
Note to implementer: selectors must match the actual markup you built in Phase 2 — open the app (`npm run dev` with `AUTH_DEV_BYPASS=true`) and adjust queries so the test is green and meaningful. If a step is brittle, assert the most stable observable outcome (e.g. a balance text changing) rather than exact button text.

- [ ] **Step 3: Run E2E, then commit**

Run: `npx playwright test` (Expected: the flow spec passes; first run may need `npx playwright install`).
```bash
git add playwright.config.ts e2e
git commit -m "test: e2e core budget flows via auth bypass"
```

---

## Task 8: Phase 3 verification

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: typecheck PASS, lint clean, all unit tests green (Phase 1–2 + the 9 reconcile tests).

- [ ] **Step 2: Manual sanity (optional, needs Akahu env)**

With real `AKAHU_APP_TOKEN`/`AKAHU_USER_TOKEN` in `.env`: in Settings, "Connect / sync accounts", then "Sync now"; confirm transactions appear on the Transactions page and allocating one, then syncing again, does NOT unallocate it.

- [ ] **Step 3: Commit any cleanup**

```bash
git add -A && git commit -m "chore: phase 3 cleanup"
```

---

## Self-review notes

- **Spec coverage (§8):** stable account identity (Task 3 upsert by accountNumber→akahuId); non-destructive delete (Task 3, schema SetNull); dedup via externalId/hash/fuzzy (Task 2 `decideSyncAction`); classify on ingest + rules for pending & confirmed (Task 4 `autoCategorize`/`autoCategorizePending`); pending lifecycle reconcile-in-place, never delete-and-recreate, `needsReview` for unbalanced splits and allocation-bearing disappeared pendings (Task 2 `reconcileAllocations` + Task 4 `syncPending`); full refresh (Task 4 `full` → 365-day window); pull-to-refresh + sync UI (Tasks 5–6); graceful per-account failure (Task 4 try/catch + Akahu error → 502).
- **Tested core:** the reconciliation decisions are pure and unit-tested (9 cases incl. reissued-id-by-hash and split-stays-on-amount-change). Orchestration is DB-bound (consistent with the repo's no-integration-DB approach) and delegates decisions to the tested functions.
- **Not in scope:** offline mutation queue/flush (TanStack persistence already caches reads; deferred as optional polish), and Akahu-live E2E (needs creds).

---

## After Phase 3

The rebuild's three phases are complete. Remaining optional polish (own mini-plans if wanted): offline write-queue, reporting/export, push notifications. Then `superpowers:finishing-a-development-branch` to integrate.
