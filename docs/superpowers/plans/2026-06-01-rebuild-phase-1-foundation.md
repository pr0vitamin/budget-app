# Cat Budget Rebuild — Phase 1: Foundation (data model, domain logic, API)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the durable, user-owned data model and a fully-tested REST API that the local-first client (Phase 2) and Akahu sync engine (Phase 3) will sit on top of.

**Architecture:** A fresh Prisma schema where the `User` owns the transaction ledger (account links are nullable and never cascade-delete), income is a first-class `kind`, and all correctness-critical logic lives in pure, unit-tested functions in `src/lib/domain/`. Thin Next.js API routes delegate to those functions. No Akahu code and no UI in this phase.

**Tech Stack:** Next.js 16 (App Router, route handlers), Prisma 7 + Postgres (Supabase), Supabase Auth (server client), Vitest (pure-function unit tests), TypeScript.

---

## Conventions for the executor

- **Prisma client:** always `import { prisma } from '@/lib/db'`.
- **Auth in routes:** use the helper built in Task 9 (`getAuthedUserId`).
- **Tests:** colocated `*.test.ts`, pure functions only (no DB) — matches the existing repo. Run a single file with `npx vitest run <path>`; run all with `npm run test:run`.
- **Commits:** this repo requires every commit message to end with the trailer
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. The commit commands below omit it for brevity — **append it to every commit.**
- **Money:** all money is `Decimal(12,2)` in the DB; convert to `number` with `Number(value)` at the boundary. Amounts are signed (negative = outflow).
- After each task: `npm run typecheck` must pass before committing.

---

## File structure (Phase 1)

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Durable-ledger schema (replaced) |
| `supabase/migrations/<ts>_rls_v2.sql` | RLS policies for the new model |
| `src/lib/db.ts` | Prisma client (unchanged) |
| `src/lib/domain/classify.ts` | Transaction `kind` classification (pure) |
| `src/lib/domain/balances.ts` | Bucket balance + Available-to-Budget (pure) |
| `src/lib/domain/split.ts` | Split validation + auto-remainder (pure) |
| `src/lib/domain/rules.ts` | Categorization rule matching (pure) |
| `src/lib/domain/dedup.ts` | Akahu dedup + account identity keys (pure, used in Phase 3) |
| `src/lib/auth.ts` | `getAuthedUserId()` route helper |
| `src/lib/ensure-user.ts` | Sync Supabase user → `User` row (kept) |
| `src/app/api/**` | REST route handlers (thin) |

**Clean-slate reset (Task 1):** the whole old surface is removed — old `src/lib` logic (scheduled, auto-match, sync, akahu, auto-categorize, calculate-available, budget-utils, offline), all old `src/app/api`, old pages/page-clients, `src/components`, and `src/hooks`. Auth, Supabase/Prisma plumbing, and a minimal layout are kept. The backend is rebuilt in this plan; the UI is rebuilt in Phase 2. (Akahu and categorization logic are rebuilt fresh in `src/lib/domain/` and Phase 3.)

---

## Task 1: Dependencies & clean-slate reset

This is a greenfield rebuild: clear the old `lib`, API, and UI surface so Phase 1 can rebuild the backend cleanly and Phase 2 can rebuild the UI. We keep only auth, the Supabase/Prisma plumbing, and a minimal layout so the project typechecks at every step.

**Keep (do NOT delete):** `src/middleware.ts`, `src/lib/db.ts`, `src/lib/ensure-user.ts`, `src/lib/supabase/**`, `src/app/login/**`, `src/app/auth/**`, `src/app/globals.css`, `src/app/favicon.ico`, `public/**`, all config files.

**Files:**
- Modify: `package.json`, `src/app/layout.tsx`, `src/app/page.tsx`

- [x] **Step 1: Remove drag + add data-layer deps**

Run:
```bash
npm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tanstack/react-query@^5 @tanstack/react-query-persist-client@^5 @tanstack/query-async-storage-persister@^5
```

- [x] **Step 2: Delete the old lib, API, and UI surface**

Run:
```bash
# Old lib (logic rebuilt in src/lib/domain/ and Phase 3)
git rm src/lib/scheduled-utils.ts src/lib/scheduled-utils.test.ts \
       src/lib/auto-match.ts src/lib/sync-pending.ts \
       src/lib/sync-transactions.ts src/lib/sync-transactions.test.ts \
       src/lib/akahu.ts src/lib/auto-categorize.ts \
       src/lib/calculate-available.ts \
       src/lib/budget-utils.ts src/lib/budget-utils.test.ts \
       src/lib/allocation.test.ts
git rm -r src/lib/offline src/hooks

# All old API routes (recreated fresh in Tasks 10–15)
git rm -r src/app/api

# Old UI pages + page clients (rebuilt in Phase 2)
git rm src/app/BucketsPageClient.tsx src/app/loading.tsx
git rm -r src/app/inbox src/app/settings src/app/upcoming src/app/rules

# Old components (ported/rebuilt in Phase 2)
git rm -r src/components
```

- [x] **Step 3: Replace layout + home with a minimal placeholder**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cat Budget',
  description: 'Bucket budgeting with cat piggy banks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
// Placeholder home — the buckets UI is rebuilt in Phase 2.
export default function HomePage() {
  return <main>Cat Budget — API foundation (Phase 1).</main>;
}
```

- [x] **Step 4: Verify a clean slate**

Run: `npm run typecheck`
Expected: PASS — no dangling imports. If any file still references a deleted module, delete or stub that file until typecheck passes (it belongs to the old UI and is rebuilt in Phase 2). Keep the files in the "Keep" list above.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean-slate reset for rebuild (remove old lib/api/ui, swap deps)"
```

---

## Task 2: Durable-ledger Prisma schema

**Files:**
- Modify (replace body below the generator/datasource blocks): `prisma/schema.prisma`

- [x] **Step 1: Replace the model definitions**

Replace everything in `prisma/schema.prisma` *after* the `datasource db { ... }` block with:

```prisma
// ============================================================================
// USER & SETTINGS
// ============================================================================

model User {
  id           String   @id // Supabase auth user id (uuid as text)
  email        String   @unique
  createdAt    DateTime @default(now())
  lastActiveAt DateTime @default(now())

  accounts            Account[]
  bucketGroups        BucketGroup[]
  transactions        Transaction[]
  budgetAllocations   BudgetAllocation[]
  categorizationRules CategorizationRule[]
  settings            UserSettings?
}

model UserSettings {
  id              String  @id @default(cuid())
  userId          String  @unique
  initialSyncDays Int     @default(30) // how far back the first Akahu sync reaches (max 30)
  theme           String  @default("system") // system | light | dark

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============================================================================
// BANK ACCOUNTS (a replaceable link, never the owner of transactions)
// ============================================================================

model Account {
  id               String    @id @default(cuid())
  userId           String
  akahuId          String // Akahu account id (volatile across reconnection)
  accountNumber    String? // stable formatted account number, e.g. "12-1234-1234567-00"
  name             String
  institution      String
  accountType      String
  balanceCurrent   Decimal?  @db.Decimal(12, 2)
  balanceAvailable Decimal?  @db.Decimal(12, 2)
  currency         String    @default("NZD")
  status           String    @default("ACTIVE")
  connectionLogo   String?
  lastSyncAt       DateTime?
  connectionError  String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@unique([userId, akahuId])
  @@unique([userId, accountNumber])
  @@index([userId])
}

// ============================================================================
// BUCKETS & GROUPS
// ============================================================================

model BucketGroup {
  id          String   @id @default(cuid())
  userId      String
  name        String
  sortOrder   Int      @default(0)
  isCollapsed Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  buckets Bucket[]

  @@index([userId])
}

model Bucket {
  id           String   @id @default(cuid())
  groupId      String
  name         String
  icon         String?
  color        String   @default("#6366f1")
  targetAmount Decimal? @db.Decimal(12, 2) // optional goal; drives the fill gauge
  topUpAmount  Decimal  @default(0) @db.Decimal(12, 2) // single-feed amount / Feed All amount
  sortOrder    Int      @default(0)
  isArchived   Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  group               BucketGroup          @relation(fields: [groupId], references: [id], onDelete: Cascade)
  allocations         Allocation[]
  budgetAllocations   BudgetAllocation[]
  categorizationRules CategorizationRule[]

  @@index([groupId])
}

// ============================================================================
// TRANSACTIONS & ALLOCATIONS (user-owned ledger)
// ============================================================================

model Transaction {
  id             String   @id @default(cuid())
  userId         String // owner — survives account deletion
  accountId      String? // nullable link; SetNull on account delete
  source         String   @default("manual") // akahu | manual
  externalId     String?  @unique // Akahu transaction id
  hash           String? // Akahu dedup hash
  kind           String   @default("expense") // income | expense | transfer
  amount         Decimal  @db.Decimal(12, 2) // signed: negative = outflow
  merchant       String?
  description    String?
  date           DateTime @db.Date
  category       String?
  balanceAfter   Decimal? @db.Decimal(12, 2)
  status         String   @default("confirmed") // pending | confirmed
  isReclassified Boolean  @default(false)
  needsReview    Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  account     Account?     @relation(fields: [accountId], references: [id], onDelete: SetNull)
  allocations Allocation[]

  @@index([userId])
  @@index([accountId])
  @@index([date])
  @@index([status])
  @@index([hash])
}

model Allocation {
  id            String  @id @default(cuid())
  transactionId String
  bucketId      String
  amount        Decimal @db.Decimal(12, 2) // signed; carries the transaction's sign

  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  bucket      Bucket      @relation(fields: [bucketId], references: [id], onDelete: Cascade)

  @@unique([transactionId, bucketId])
  @@index([bucketId])
}

model BudgetAllocation {
  id        String   @id @default(cuid())
  userId    String
  bucketId  String
  amount    Decimal  @db.Decimal(12, 2) // positive — money fed from income pool into a bucket
  note      String?
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  bucket Bucket @relation(fields: [bucketId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([bucketId])
}

// ============================================================================
// CATEGORIZATION RULES
// ============================================================================

model CategorizationRule {
  id              String   @id @default(cuid())
  userId          String
  bucketId        String
  merchantPattern String // stored lowercase; substring match
  createdAt       DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  bucket Bucket @relation(fields: [bucketId], references: [id], onDelete: Cascade)

  @@unique([userId, merchantPattern])
  @@index([userId])
}
```

- [x] **Step 2: Reset the database to the new schema**

Run:
```bash
npm run db:push
```
Expected: Prisma reports the schema is in sync and regenerates the client. (Fresh DB per the spec — no data migration.)

- [x] **Step 3: Verify the client generated**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: durable user-owned ledger schema"
```

---

## Task 3: Row-Level Security policies for the new model

**Files:**
- Create: `supabase/migrations/20260601_rls_v2.sql`
- Delete: `supabase/migrations/20260105_rls_policies.sql`

- [x] **Step 1: Write the new RLS policy file**

Because `Transaction` now has a direct `userId`, transaction/allocation policies simplify. Create `supabase/migrations/20260601_rls_v2.sql`:

```sql
-- RLS v2 for the durable-ledger model. Run in the Supabase SQL editor.
-- Every table is scoped to the authenticated user.

-- Helper note: auth.uid() returns uuid; our ids are text, so cast.

-- USER
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_select" ON "User" FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "user_update" ON "User" FOR UPDATE USING (id = auth.uid()::text);
CREATE POLICY "user_insert" ON "User" FOR INSERT WITH CHECK (id = auth.uid()::text);

-- USER SETTINGS
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_all" ON "UserSettings" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- ACCOUNT
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_all" ON "Account" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- BUCKET GROUP
ALTER TABLE "BucketGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_all" ON "BucketGroup" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- BUCKET (scoped via its group)
ALTER TABLE "Bucket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bucket_all" ON "Bucket" FOR ALL
  USING (EXISTS (SELECT 1 FROM "BucketGroup" bg WHERE bg.id = "Bucket"."groupId" AND bg."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "BucketGroup" bg WHERE bg.id = "groupId" AND bg."userId" = auth.uid()::text));

-- TRANSACTION (direct userId — no account join needed)
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_all" ON "Transaction" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- ALLOCATION (scoped via its transaction)
ALTER TABLE "Allocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alloc_all" ON "Allocation" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Transaction" t WHERE t.id = "Allocation"."transactionId" AND t."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Transaction" t WHERE t.id = "transactionId" AND t."userId" = auth.uid()::text));

-- BUDGET ALLOCATION
ALTER TABLE "BudgetAllocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgetalloc_all" ON "BudgetAllocation" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- CATEGORIZATION RULE
ALTER TABLE "CategorizationRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_all" ON "CategorizationRule" FOR ALL
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
```

- [x] **Step 2: Remove the old policy file and apply the new one**

Run:
```bash
git rm supabase/migrations/20260105_rls_policies.sql
```
Then run the contents of `supabase/migrations/20260601_rls_v2.sql` in the Supabase SQL editor (the server uses the Prisma service connection, but RLS protects any anon/client access). Note: the API routes use Prisma over the pooled service connection, so functionally the API is authorized in code via `getAuthedUserId` (Task 9); RLS is defense-in-depth.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat: RLS policies for durable-ledger model"
```

---

## Task 4: Domain — transaction classification (`kind`)

**Files:**
- Create: `src/lib/domain/classify.ts`
- Test: `src/lib/domain/classify.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { classifyKind } from './classify';

describe('classifyKind', () => {
  it('classifies a positive amount as income', () => {
    expect(classifyKind({ type: 'CREDIT', amount: 1200 })).toBe('income');
  });

  it('classifies a negative amount as expense', () => {
    expect(classifyKind({ type: 'DEBIT', amount: -42.5 })).toBe('expense');
  });

  it('classifies an Akahu TRANSFER as transfer regardless of sign', () => {
    expect(classifyKind({ type: 'TRANSFER', amount: 500 })).toBe('transfer');
    expect(classifyKind({ type: 'TRANSFER', amount: -500 })).toBe('transfer');
  });

  it('treats missing type by falling back to sign', () => {
    expect(classifyKind({ amount: 30 })).toBe('income');
    expect(classifyKind({ amount: -30 })).toBe('expense');
  });

  it('treats a zero amount as expense (needs allocation review)', () => {
    expect(classifyKind({ amount: 0 })).toBe('expense');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/domain/classify.test.ts`
Expected: FAIL — cannot find module `./classify`.

- [x] **Step 3: Implement**

```typescript
export type TransactionKind = 'income' | 'expense' | 'transfer';

export interface ClassifyInput {
  type?: string | null;
  amount: number;
}

const TRANSFER_TYPES = new Set(['TRANSFER', 'STANDING ORDER']);

/**
 * Auto-classify a transaction's kind from its Akahu type and signed amount.
 * Transfers are detected by type; everything else falls back to sign.
 * The user can override this in the inbox (see Transaction.isReclassified).
 */
export function classifyKind({ type, amount }: ClassifyInput): TransactionKind {
  if (type && TRANSFER_TYPES.has(type.toUpperCase())) {
    return 'transfer';
  }
  return amount > 0 ? 'income' : 'expense';
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/domain/classify.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/domain/classify.ts src/lib/domain/classify.test.ts
git commit -m "feat: transaction kind classification"
```

---

## Task 5: Domain — bucket balance & Available-to-Budget

**Files:**
- Create: `src/lib/domain/balances.ts`
- Test: `src/lib/domain/balances.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBucketBalance, calculateAvailableToBudget } from './balances';

describe('calculateBucketBalance', () => {
  it('is zero with no feeds or allocations', () => {
    expect(calculateBucketBalance({ feeds: [], allocations: [] })).toBe(0);
  });

  it('adds feeds and subtracts expense allocations (negative)', () => {
    // fed $500, spent $75.50 + $42.30
    expect(
      calculateBucketBalance({ feeds: [500], allocations: [-75.5, -42.3] })
    ).toBeCloseTo(382.2, 2);
  });

  it('treats a positive (refund) allocation as increasing the balance', () => {
    expect(calculateBucketBalance({ feeds: [100], allocations: [-30, 10] })).toBeCloseTo(80, 2);
  });
});

describe('calculateAvailableToBudget', () => {
  it('is income minus total feeds', () => {
    expect(calculateAvailableToBudget({ incomeTotal: 2000, feedsTotal: 1500 })).toBe(500);
  });

  it('can be zero', () => {
    expect(calculateAvailableToBudget({ incomeTotal: 1500, feedsTotal: 1500 })).toBe(0);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/domain/balances.test.ts`
Expected: FAIL — cannot find module `./balances`.

- [x] **Step 3: Implement**

```typescript
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export interface BucketBalanceInput {
  feeds: number[]; // BudgetAllocation amounts (positive)
  allocations: number[]; // Allocation amounts (signed; expenses negative, refunds positive)
}

/** Bucket balance = money fed in + signed spending allocations. */
export function calculateBucketBalance({ feeds, allocations }: BucketBalanceInput): number {
  return sum(feeds) + sum(allocations);
}

export interface AvailableInput {
  incomeTotal: number; // sum of transactions where kind = income
  feedsTotal: number; // sum of all BudgetAllocations
}

/** Available to Budget = recorded income − money already fed into buckets. */
export function calculateAvailableToBudget({ incomeTotal, feedsTotal }: AvailableInput): number {
  return incomeTotal - feedsTotal;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/domain/balances.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/domain/balances.ts src/lib/domain/balances.test.ts
git commit -m "feat: bucket balance and available-to-budget calculations"
```

---

## Task 6: Domain — split validation & auto-remainder

**Files:**
- Create: `src/lib/domain/split.ts`
- Test: `src/lib/domain/split.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { computeAutoRemainder, validateSplit } from './split';

describe('computeAutoRemainder', () => {
  it('returns the remainder for the single unentered bucket', () => {
    // $12.90 total, Pet entered $4.50, Groceries unentered
    const result = computeAutoRemainder(-12.9, [
      { bucketId: 'pet', amount: -4.5 },
      { bucketId: 'groceries', amount: null },
    ]);
    expect(result).toEqual({ bucketId: 'groceries', amount: -8.4 });
  });

  it('returns null when two or more buckets are unentered', () => {
    const result = computeAutoRemainder(-12.9, [
      { bucketId: 'pet', amount: null },
      { bucketId: 'groceries', amount: null },
    ]);
    expect(result).toBeNull();
  });

  it('returns null when every bucket already has an amount', () => {
    const result = computeAutoRemainder(-12.9, [
      { bucketId: 'pet', amount: -4.5 },
      { bucketId: 'groceries', amount: -8.4 },
    ]);
    expect(result).toBeNull();
  });
});

describe('validateSplit', () => {
  it('accepts allocations that sum to the transaction amount', () => {
    expect(validateSplit(-12.9, [{ amount: -4.5 }, { amount: -8.4 }])).toEqual({
      valid: true,
      remaining: 0,
    });
  });

  it('reports the remaining amount when under-allocated', () => {
    expect(validateSplit(-12.9, [{ amount: -4.5 }])).toEqual({
      valid: false,
      remaining: -8.4,
    });
  });

  it('tolerates floating-point noise within a cent', () => {
    expect(validateSplit(-10, [{ amount: -3.33 }, { amount: -3.33 }, { amount: -3.34 }]).valid).toBe(
      true
    );
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/domain/split.test.ts`
Expected: FAIL — cannot find module `./split`.

- [x] **Step 3: Implement**

```typescript
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface DraftAllocation {
  bucketId: string;
  amount: number | null; // null = not yet entered
}

/**
 * When exactly one bucket in the split has no amount entered, return that
 * bucket filled with the remaining amount. Otherwise return null (ambiguous
 * or already complete). Used to auto-fill the last bucket in a split.
 */
export function computeAutoRemainder(
  transactionAmount: number,
  drafts: DraftAllocation[]
): { bucketId: string; amount: number } | null {
  const unentered = drafts.filter((d) => d.amount === null);
  if (unentered.length !== 1) return null;

  const enteredTotal = drafts.reduce((s, d) => s + (d.amount ?? 0), 0);
  const remainder = round2(transactionAmount - enteredTotal);
  return { bucketId: unentered[0].bucketId, amount: remainder };
}

/**
 * Validate that a set of allocation amounts sums to the transaction amount,
 * within a one-cent tolerance for floating-point noise.
 */
export function validateSplit(
  transactionAmount: number,
  allocations: { amount: number }[]
): { valid: boolean; remaining: number } {
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  const remaining = round2(transactionAmount - total);
  return { valid: Math.abs(remaining) < 0.01, remaining };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/domain/split.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/domain/split.ts src/lib/domain/split.test.ts
git commit -m "feat: split validation and auto-remainder"
```

---

## Task 7: Domain — categorization rule matching

**Files:**
- Create: `src/lib/domain/rules.ts`
- Test: `src/lib/domain/rules.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { findMatchingRule, normalizePattern } from './rules';

const rules = [
  { id: 'r1', merchantPattern: 'countdown', bucketId: 'groceries' },
  { id: 'r2', merchantPattern: 'z energy', bucketId: 'fuel' },
];

describe('findMatchingRule', () => {
  it('matches case-insensitively on a substring of the merchant', () => {
    expect(findMatchingRule('COUNTDOWN PONSONBY', rules)?.id).toBe('r1');
  });

  it('matches against a raw pending description (no enriched merchant)', () => {
    expect(findMatchingRule('pos w/d z energy 123', rules)?.id).toBe('r2');
  });

  it('returns null when nothing matches', () => {
    expect(findMatchingRule('new world', rules)).toBeNull();
  });

  it('returns null for an empty merchant', () => {
    expect(findMatchingRule('', rules)).toBeNull();
    expect(findMatchingRule(null, rules)).toBeNull();
  });

  it('applies the first matching rule only', () => {
    const overlapping = [
      { id: 'a', merchantPattern: 'z', bucketId: 'x' },
      { id: 'b', merchantPattern: 'z energy', bucketId: 'y' },
    ];
    expect(findMatchingRule('z energy', overlapping)?.id).toBe('a');
  });
});

describe('normalizePattern', () => {
  it('lowercases and trims', () => {
    expect(normalizePattern('  Countdown ')).toBe('countdown');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/domain/rules.test.ts`
Expected: FAIL — cannot find module `./rules`.

- [x] **Step 3: Implement**

```typescript
export interface Rule {
  id: string;
  merchantPattern: string; // stored lowercase
  bucketId: string;
}

/** Normalize a user-entered pattern for storage and comparison. */
export function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase();
}

/**
 * Find the first rule whose pattern is a substring of the merchant/description.
 * Matching is case-insensitive. Works for both enriched merchants (confirmed)
 * and raw descriptions (pending), since rules use substring matching.
 */
export function findMatchingRule(merchant: string | null | undefined, rules: Rule[]): Rule | null {
  if (!merchant) return null;
  const haystack = merchant.toLowerCase();
  for (const rule of rules) {
    if (rule.merchantPattern && haystack.includes(rule.merchantPattern)) {
      return rule;
    }
  }
  return null;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/domain/rules.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/domain/rules.ts src/lib/domain/rules.test.ts
git commit -m "feat: categorization rule matching"
```

---

## Task 8: Domain — Akahu dedup & account identity (pure)

**Files:**
- Create: `src/lib/domain/dedup.ts`
- Test: `src/lib/domain/dedup.test.ts`

These pure helpers are consumed by the Phase 3 sync engine but belong with the domain logic and are unit-testable now.

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { accountIdentityKey, fallbackDedupKey, transactionsMatch } from './dedup';

describe('accountIdentityKey', () => {
  it('prefers the stable account number when present', () => {
    expect(accountIdentityKey({ akahuId: 'acc_new', accountNumber: '12-1234-1234567-00' })).toBe(
      'num:12-1234-1234567-00'
    );
  });

  it('falls back to the akahu id when there is no account number', () => {
    expect(accountIdentityKey({ akahuId: 'acc_x', accountNumber: null })).toBe('akahu:acc_x');
  });
});

describe('fallbackDedupKey', () => {
  it('builds a stable key from account, date, amount and description', () => {
    const key = fallbackDedupKey({
      accountId: 'a1',
      date: new Date('2026-05-01T10:00:00Z'),
      amount: -12.9,
      description: 'Countdown',
    });
    expect(key).toBe('a1:2026-05-01:-12.90:countdown');
  });
});

describe('transactionsMatch', () => {
  const base = { date: new Date('2026-05-01'), amount: -12.9, description: 'Countdown Ponsonby' };

  it('matches an identical incoming transaction', () => {
    expect(transactionsMatch(base, { ...base })).toBe(true);
  });

  it('matches when a pending amount settles within tolerance', () => {
    // pending $1.00 pre-auth settles to $1.05, same day/desc
    expect(
      transactionsMatch(
        { date: new Date('2026-05-01'), amount: -1, description: 'Cafe Hold' },
        { date: new Date('2026-05-01'), amount: -1.05, description: 'Cafe Hold' }
      )
    ).toBe(true);
  });

  it('does not match different merchants on the same day/amount', () => {
    expect(
      transactionsMatch(base, { date: new Date('2026-05-01'), amount: -12.9, description: 'BP Fuel' })
    ).toBe(false);
  });

  it('does not match when dates are more than 5 days apart', () => {
    expect(
      transactionsMatch(base, { ...base, date: new Date('2026-05-10') })
    ).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/domain/dedup.test.ts`
Expected: FAIL — cannot find module `./dedup`.

- [x] **Step 3: Implement**

```typescript
const isoDate = (d: Date): string => d.toISOString().split('T')[0];

/** Stable identity for a bank account: account number if known, else Akahu id. */
export function accountIdentityKey(account: { akahuId: string; accountNumber?: string | null }): string {
  return account.accountNumber ? `num:${account.accountNumber}` : `akahu:${account.akahuId}`;
}

/** Last-resort dedup key when neither externalId nor Akahu hash is available. */
export function fallbackDedupKey(tx: {
  accountId: string;
  date: Date;
  amount: number;
  description: string | null;
}): string {
  return `${tx.accountId}:${isoDate(tx.date)}:${tx.amount.toFixed(2)}:${(tx.description ?? '')
    .trim()
    .toLowerCase()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function descriptionsSimilar(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  const words = (s: string) => new Set(s.split(/\s+/).filter((w) => w.length >= 3));
  const wa = words(x);
  for (const w of words(y)) if (wa.has(w)) return true;
  return false;
}

export interface MatchCandidate {
  date: Date;
  amount: number;
  description: string | null;
}

/**
 * Decide whether two transactions are the same real-world transaction.
 * Used to reconcile pending → confirmed and to absorb Akahu-reissued ids:
 * within 5 days, amount within 30% (handles pre-auth settling), similar description.
 */
export function transactionsMatch(a: MatchCandidate, b: MatchCandidate): boolean {
  const daysApart = Math.abs(a.date.getTime() - b.date.getTime()) / DAY_MS;
  if (daysApart > 5) return false;

  const tolerance = Math.max(Math.abs(a.amount) * 0.3, 0.05);
  if (Math.abs(a.amount - b.amount) > tolerance) return false;

  return descriptionsSimilar(a.description ?? '', b.description ?? '');
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/domain/dedup.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/domain/dedup.ts src/lib/domain/dedup.test.ts
git commit -m "feat: akahu dedup and account identity helpers"
```

---

## Task 9: Auth helper for route handlers

**Files:**
- Create: `src/lib/auth.ts`
- Keep: `src/lib/ensure-user.ts` (already correct against the new `User` model)

- [x] **Step 1: Implement the helper**

```typescript
import { createClient } from '@/lib/supabase/server';
import { ensureUserExists } from '@/lib/ensure-user';

/**
 * Resolve the authenticated user's id for a route handler, ensuring a matching
 * row exists in our User table. Returns null when unauthenticated so the caller
 * can respond 401.
 */
export async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await ensureUserExists(user);
  return user.id;
}
```

- [x] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (the helper reuses the kept `@/lib/supabase/server` and `@/lib/ensure-user`).

- [x] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: getAuthedUserId route helper"
```

---

## Task 10: Buckets & bucket-groups API

**Files:**
- Create: `src/app/api/bucket-groups/route.ts`
- Create: `src/app/api/bucket-groups/[id]/route.ts`
- Create: `src/app/api/bucket-groups/reorder/route.ts`
- Create: `src/app/api/buckets/route.ts`
- Create: `src/app/api/buckets/[id]/route.ts`
- Create: `src/app/api/buckets/reorder/route.ts`

Note: all old API routes were removed in Task 1, so these are created fresh.

- [x] **Step 1: Bucket groups collection + item + reorder**

`src/app/api/bucket-groups/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.bucketGroup.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    include: { buckets: { where: { isArchived: false }, orderBy: { sortOrder: 'asc' } } },
  });
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const count = await prisma.bucketGroup.count({ where: { userId } });
  const group = await prisma.bucketGroup.create({
    data: { userId, name, sortOrder: count },
  });
  return NextResponse.json(group, { status: 201 });
}
```

`src/app/api/bucket-groups/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.bucketGroup.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const group = await prisma.bucketGroup.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      isCollapsed: typeof body.isCollapsed === 'boolean' ? body.isCollapsed : undefined,
    },
  });
  return NextResponse.json(group);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.bucketGroup.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.bucketGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

`src/app/api/bucket-groups/reorder/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Body: { order: string[] } — group ids in their new order.
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order } = await request.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 });

  const owned = await prisma.bucketGroup.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((g) => g.id));

  await prisma.$transaction(
    order
      .filter((id: string) => ownedIds.has(id))
      .map((id: string, index: number) =>
        prisma.bucketGroup.update({ where: { id }, data: { sortOrder: index } })
      )
  );
  return NextResponse.json({ success: true });
}
```

- [x] **Step 2: Buckets collection + item + reorder**

`src/app/api/buckets/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { groupId, name } = body;
  if (!groupId || !name) {
    return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 });
  }
  const group = await prisma.bucketGroup.findFirst({ where: { id: groupId, userId } });
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const count = await prisma.bucket.count({ where: { groupId } });
  const bucket = await prisma.bucket.create({
    data: {
      groupId,
      name,
      icon: body.icon ?? null,
      color: body.color ?? undefined,
      targetAmount: body.targetAmount ?? null,
      topUpAmount: body.topUpAmount ?? 0,
      sortOrder: count,
    },
  });
  return NextResponse.json(bucket, { status: 201 });
}
```

`src/app/api/buckets/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

async function ownsBucket(userId: string, id: string): Promise<boolean> {
  const bucket = await prisma.bucket.findFirst({
    where: { id, group: { userId } },
    select: { id: true },
  });
  return Boolean(bucket);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownsBucket(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const bucket = await prisma.bucket.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      icon: body.icon === undefined ? undefined : body.icon,
      color: body.color ?? undefined,
      targetAmount: body.targetAmount === undefined ? undefined : body.targetAmount,
      topUpAmount: body.topUpAmount === undefined ? undefined : body.topUpAmount,
      groupId: body.groupId ?? undefined,
    },
  });
  return NextResponse.json(bucket);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownsBucket(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Soft delete so historical allocations remain meaningful.
  await prisma.bucket.update({ where: { id }, data: { isArchived: true } });
  return NextResponse.json({ success: true });
}
```

`src/app/api/buckets/reorder/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Body: { order: string[] } — bucket ids in their new order (within/across groups).
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order } = await request.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 });

  const owned = await prisma.bucket.findMany({ where: { group: { userId } }, select: { id: true } });
  const ownedIds = new Set(owned.map((b) => b.id));

  await prisma.$transaction(
    order
      .filter((id: string) => ownedIds.has(id))
      .map((id: string, index: number) =>
        prisma.bucket.update({ where: { id }, data: { sortOrder: index } })
      )
  );
  return NextResponse.json({ success: true });
}
```

- [x] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/app/api/buckets src/app/api/bucket-groups
git commit -m "feat: buckets and bucket-groups API"
```

---

## Task 11: Transactions API (list, create, patch/reclassify, delete)

**Files:**
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/[id]/route.ts`

- [x] **Step 1: Collection (list + manual create)**

`src/app/api/transactions/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { classifyKind } from '@/lib/domain/classify';

// GET /api/transactions?status=&kind=&unallocated=true
export async function GET(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const kind = searchParams.get('kind');
  const unallocated = searchParams.get('unallocated') === 'true';

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
      ...(unallocated ? { allocations: { none: {} } } : {}),
    },
    orderBy: { date: 'desc' },
    include: { allocations: { include: { bucket: { select: { id: true, name: true, color: true } } } } },
  });
  return NextResponse.json(transactions);
}

// POST — manual transaction entry. Body: { amount, date, merchant?, description?, kind? }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const amount = Number(body.amount);
  if (Number.isNaN(amount) || !body.date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 });
  }
  const kind = body.kind ?? classifyKind({ amount });

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      source: 'manual',
      amount,
      date: new Date(body.date),
      merchant: body.merchant ?? null,
      description: body.description ?? null,
      kind,
      status: 'confirmed',
    },
  });
  return NextResponse.json(transaction, { status: 201 });
}
```

- [x] **Step 2: Item (patch incl. reclassify; delete manual only)**

`src/app/api/transactions/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const reclassifying = body.kind && body.kind !== existing.kind;

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      kind: body.kind ?? undefined,
      merchant: body.merchant === undefined ? undefined : body.merchant,
      description: body.description === undefined ? undefined : body.description,
      isReclassified: reclassifying ? true : undefined,
      // Clearing needsReview is an explicit user action.
      needsReview: typeof body.needsReview === 'boolean' ? body.needsReview : undefined,
    },
  });
  return NextResponse.json(transaction);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.source !== 'manual') {
    return NextResponse.json({ error: 'Only manual transactions can be deleted' }, { status: 400 });
  }
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [x] **Step 3: Typecheck the new files**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/app/api/transactions
git commit -m "feat: transactions API with reclassification"
```

---

## Task 12: Allocations API (allocate incl. split; remove allocation)

**Files:**
- Create: `src/app/api/transactions/[id]/allocate/route.ts`
- Create: `src/app/api/transactions/[id]/allocations/[bucketId]/route.ts`

- [x] **Step 1: Allocate (single or split) with server-side validation**

`src/app/api/transactions/[id]/allocate/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { validateSplit } from '@/lib/domain/split';

// Body: { allocations: { bucketId: string; amount: number }[] }
// Replaces the transaction's allocations atomically. Allocations must sum to
// the transaction amount (validated here as defense-in-depth; the client also
// enforces it and offers auto-remainder).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const allocations: { bucketId: string; amount: number }[] = body.allocations ?? [];
  if (allocations.length === 0) {
    return NextResponse.json({ error: 'allocations required' }, { status: 400 });
  }

  // All buckets must belong to the user.
  const bucketIds = allocations.map((a) => a.bucketId);
  const ownedCount = await prisma.bucket.count({
    where: { id: { in: bucketIds }, group: { userId } },
  });
  if (ownedCount !== new Set(bucketIds).size) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
  }

  const { valid, remaining } = validateSplit(Number(transaction.amount), allocations);
  if (!valid) {
    return NextResponse.json(
      { error: `Allocations must sum to the transaction amount; remaining ${remaining}` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.allocation.deleteMany({ where: { transactionId: id } }),
    prisma.allocation.createMany({
      data: allocations.map((a) => ({ transactionId: id, bucketId: a.bucketId, amount: a.amount })),
    }),
    // A fresh, balanced allocation clears any prior review flag.
    prisma.transaction.update({ where: { id }, data: { needsReview: false } }),
  ]);

  const updated = await prisma.transaction.findUnique({
    where: { id },
    include: { allocations: { include: { bucket: { select: { id: true, name: true, color: true } } } } },
  });
  return NextResponse.json(updated);
}
```

- [x] **Step 2: Remove a single allocation from a split**

`src/app/api/transactions/[id]/allocations/[bucketId]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bucketId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, bucketId } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.allocation.deleteMany({ where: { transactionId: id, bucketId } });
  return NextResponse.json({ success: true });
}
```

- [x] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/app/api/transactions
git commit -m "feat: allocation API with split validation"
```

---

## Task 13: Budget API (available, feed, feed-all, un-feed)

**Files:**
- Create: `src/app/api/budget/available/route.ts`
- Create: `src/app/api/budget/allocations/route.ts`
- Create: `src/app/api/budget/allocations/batch/route.ts`
- Create: `src/app/api/budget/allocations/[id]/route.ts`

- [x] **Step 1: Available to budget**

`src/app/api/budget/available/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [income, feeds] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
  ]);

  const available = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });
  return NextResponse.json({ available });
}
```

- [x] **Step 2: Feed one bucket**

`src/app/api/budget/allocations/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

async function availableFor(userId: string): Promise<number> {
  const [income, feeds] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
  ]);
  return calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });
}

// Body: { bucketId: string; amount: number; note?: string }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const amount = Number(body.amount);
  if (!body.bucketId || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'bucketId and positive amount required' }, { status: 400 });
  }
  const bucket = await prisma.bucket.findFirst({ where: { id: body.bucketId, group: { userId } } });
  if (!bucket) return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

  const available = await availableFor(userId);
  if (amount > available + 0.001) {
    return NextResponse.json({ error: 'Insufficient available to budget' }, { status: 400 });
  }

  const feed = await prisma.budgetAllocation.create({
    data: { userId, bucketId: body.bucketId, amount, note: body.note ?? null },
  });
  return NextResponse.json(feed, { status: 201 });
}
```

- [x] **Step 3: Feed All (batch)**

`src/app/api/budget/allocations/batch/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

// Feeds every non-archived bucket its topUpAmount, capped at what's available.
// Buckets are processed in sortOrder; once available runs out, the rest are skipped.
export async function POST() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [income, feeds, buckets] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.bucket.findMany({
      where: { group: { userId }, isArchived: false, topUpAmount: { gt: 0 } },
      orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    }),
  ]);

  let available = calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });

  const toCreate: { userId: string; bucketId: string; amount: number }[] = [];
  for (const bucket of buckets) {
    const topUp = Number(bucket.topUpAmount);
    if (topUp <= available + 0.001) {
      toCreate.push({ userId, bucketId: bucket.id, amount: topUp });
      available -= topUp;
    }
  }

  if (toCreate.length > 0) {
    await prisma.budgetAllocation.createMany({ data: toCreate });
  }
  return NextResponse.json({ fed: toCreate.map((c) => c.bucketId) });
}
```

- [x] **Step 4: Un-feed (delete a budget allocation)**

`src/app/api/budget/allocations/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.budgetAllocation.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.budgetAllocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [x] **Step 5: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/app/api/budget
git commit -m "feat: budget feed, feed-all and available API"
```

---

## Task 14: Rules API

**Files:**
- Create: `src/app/api/rules/route.ts`
- Create: `src/app/api/rules/[id]/route.ts`

- [x] **Step 1: Collection (list + create)**

`src/app/api/rules/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { normalizePattern } from '@/lib/domain/rules';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.categorizationRule.findMany({
    where: { userId },
    include: { bucket: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rules);
}

// Body: { merchantPattern: string; bucketId: string }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.merchantPattern || !body.bucketId) {
    return NextResponse.json({ error: 'merchantPattern and bucketId required' }, { status: 400 });
  }
  const bucket = await prisma.bucket.findFirst({ where: { id: body.bucketId, group: { userId } } });
  if (!bucket) return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

  const rule = await prisma.categorizationRule.upsert({
    where: { userId_merchantPattern: { userId, merchantPattern: normalizePattern(body.merchantPattern) } },
    update: { bucketId: body.bucketId },
    create: { userId, bucketId: body.bucketId, merchantPattern: normalizePattern(body.merchantPattern) },
  });
  return NextResponse.json(rule, { status: 201 });
}
```

- [x] **Step 2: Item (delete)**

`src/app/api/rules/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.categorizationRule.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.categorizationRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [x] **Step 3: Typecheck & commit**

Run: `npm run typecheck` (Expected: PASS).
```bash
git add src/app/api/rules
git commit -m "feat: categorization rules API"
```

---

## Task 15: Settings & inbox-count API

**Files:**
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/api/inbox/count/route.ts`

- [x] **Step 1: Settings (get with default-create; patch)**

`src/app/api/settings/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return NextResponse.json(settings);
}

// Body: { initialSyncDays?: number; theme?: 'system'|'light'|'dark' }
export async function PATCH(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const initialSyncDays =
    body.initialSyncDays === undefined ? undefined : Math.min(Math.max(1, Number(body.initialSyncDays)), 30);

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: { initialSyncDays, theme: body.theme ?? undefined },
    create: { userId, initialSyncDays: initialSyncDays ?? 30, theme: body.theme ?? 'system' },
  });
  return NextResponse.json(settings);
}
```

- [x] **Step 2: Inbox count (unallocated expenses)**

`src/app/api/inbox/count/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Only expenses need allocating; income and transfers are excluded.
export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const count = await prisma.transaction.count({
    where: { userId, kind: 'expense', allocations: { none: {} } },
  });
  return NextResponse.json({ count });
}
```

- [x] **Step 3: Whole-phase verification**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck PASS, and all domain tests (classify, balances, split, rules, dedup) green. No remaining references to deleted `budget-utils`/`sync-*` tests.

- [x] **Step 4: Commit**

```bash
git add src/app/api/settings src/app/api/inbox
git commit -m "feat: settings and inbox-count API"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** durable ledger + `kind` (Task 2), RLS (Task 3), classification (Task 4), balances/available (Task 5, 13), split + auto-remainder (Task 6, 12), rules incl. pending-capable substring matching (Task 7, 14), dedup/identity for Phase 3 (Task 8), reclassification (Task 11), feed/feed-all instant-friendly endpoints (Task 13), inbox count for expenses only (Task 15). Akahu sync, accounts, and the pending lifecycle are **Phase 3**; all UI/optimistic animation is **Phase 2** — intentionally out of this plan.
- **No DB integration tests:** matches the existing repo (pure-function tests only). Integrated coverage comes from Playwright E2E in Phase 3. Route correctness here relies on the unit-tested domain functions the routes delegate to.
- **Type consistency:** route bodies use the exact field names from the schema in Task 2 (`topUpAmount`, `targetAmount`, `kind`, `needsReview`, `isReclassified`, `merchantPattern`); domain function signatures match their call sites.

---

## Phase roadmap (each becomes its own full plan after the prior lands)

**Phase 2 — Local-first client & UI** (`docs/superpowers/plans/<date>-rebuild-phase-2-client.md`)
- TanStack Query provider + IndexedDB async-storage persister; a `useResource`/query-key convention.
- App shell, bottom nav, offline indicator (ported), skeletons.
- Buckets page: cat piggy banks rendered from cache; fill gauge from `targetAmount`.
- Cash stuffing: tap-to-feed + Feed All with **optimistic local state**, sparkle/confetti firing immediately (no `router.refresh()`); rollback + toast on POST failure.
- Inbox + allocation modal: single + split, **auto-remainder** (uses `computeAutoRemainder`), "always allocate" rule creation.
- Manual entry, settings, reorder (tap up/down), PWA manifest/service worker.
- Component tests (Vitest + Testing Library) for the allocation modal and feed optimistic flow.

**Phase 3 — Akahu sync & hardening** (`docs/superpowers/plans/<date>-rebuild-phase-3-sync.md`)
- Ported Akahu client; accounts API + UI; account identity resolution via `accountIdentityKey` (no duplicate accounts on reconnection).
- Sync engine: dedup via `externalId`/`hash`/`fallbackDedupKey` + `transactionsMatch`; auto-classify `kind`; apply rules at ingestion for **pending and confirmed**; idempotent.
- Pending lifecycle: reconcile-in-place, never delete-and-recreate; pending→confirmed preserves allocations (single → update amount; split → keep + `needsReview` if unbalanced); disappearing pending only removed when allocation-free.
- Full-refresh action (wide window self-heal); pull-to-refresh; offline mutation-queue flush.
- Playwright E2E: cash-stuffing flow, split allocation, sync + pending-survives-sync, offline queue.

---

## Execution

When ready, implement this Phase 1 plan task-by-task using `superpowers:subagent-driven-development` (fresh subagent per task with review between) or `superpowers:executing-plans` (batched, in-session).
