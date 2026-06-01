# 🐱 Cat Budget — Rebuild Design Spec

_A greenfield rebuild of the bucket-based budgeting PWA. Keeps the envelope ("every dollar a
job") model and the cat-piggy-bank cash-stuffing soul of the app, fixes the data-durability bug
that lost historical income, removes accumulated dead scaffolding, and adds a local-first cache
layer so pages load instantly._

_Date: 2026-06-01 · Supersedes the original `spec.md` (which had drifted from the built code)._

---

## 1. Background & Motivation

The original app is deployed on Vercel + Supabase free tier and used daily as an installed PWA.
Three problems drive this rebuild:

1. **Data loss.** An Akahu integration change caused all historical income to disappear from the
   budget. Root cause (confirmed in the code):
   - Income has no first-class existence — it is merely "any transaction with a positive amount."
   - Transactions are owned by the bank `Account`, and account deletion is `onDelete: Cascade`.
   - Accounts are keyed on the volatile Akahu account `_id`. When Akahu reissued IDs, a duplicate
     account appeared; removing the stale one cascade-deleted its transactions — income included.
2. **Slow page loads.** Every page is a server component that queries Postgres directly, so each
   navigation pays a Vercel cold-start + several sequential Supabase queries before first paint. A
   perfectly good IndexedDB cache already exists but is not on the render path.
3. **Accumulated mess.** Period boundaries, rollover targets, scheduled transactions, and
   auto-matching are half-built and **inert** — balances are computed all-time and no period job
   ever runs. This scaffolding is a large share of the codebase's complexity for zero behaviour.

## 2. Vision & Principles

A delightful, mobile-first, single-user budgeting PWA built on envelope budgeting.

- **You own your money records.** The financial ledger is durable and owned by the user. Akahu is a
  _feed_ that flows into the ledger — never the owner of it. No external event may destroy history.
- **Every dollar has a job.** Income fills a pool; you stuff it into buckets (cat piggy banks).
- **Instant.** The UI renders from local cache first; the network refreshes it in the background.
- **Tap, don't drag.** All interactions are tap-based and mobile-native.
- **Lean.** Only ship features that are actually used. No inert scaffolding.

### Target user

Single user (personal use), New Zealand, multiple bank accounts, paid fortnightly. Not multi-tenant
in spirit, though auth still scopes all data per user.

## 3. Scope

### Kept

- Buckets organised into groups (cat piggy banks).
- Cash stuffing — tap-to-feed a bucket, "Feed All", sparkle + confetti celebrations.
- Inbox: allocating expense transactions to buckets, including splits across buckets.
- Auto-categorization rules (merchant → bucket).
- Akahu bank sync via pull-to-refresh (personal-app token auth).
- Manual transaction entry.
- Settings.
- PWA install + offline support.
- 8-digit OTP authentication (Supabase Auth).

### Dropped

- **Scheduled / upcoming expenses** and the calendar/upcoming view.
- **Auto-match** of incoming transactions to scheduled ones.
- **Period & rollover machinery**: budget-cycle boundaries, rollover flags, rollover targets, and
  the budget-cycle settings that fed them.
- **All drag-and-drop** (`@dnd-kit/*` removed). Drag-to-feed never worked; group/bucket reordering
  moves to tap controls.

### Changed / simplified

- **Durable, user-owned transaction ledger** (see §4) — the central fix.
- **First-class income** via an explicit `kind` classification (`income` / `expense` / `transfer`).
- **Bucket model simplified**: drop the `savings`/`spending` type and all rollover fields; replace
  with an optional `targetAmount` (goal / fill-gauge) and keep `topUpAmount` (the per-bucket feed
  amount).
- **Local-first rendering** with TanStack Query + IndexedDB persistence (see §6).
- **Tap-based cash stuffing and reordering** (see §5).

## 4. Data Model — the durable ledger

> The single most important change. Principle: **the user owns the ledger; the bank account is just
> an optional, replaceable link.**

### Key differences from the old model

| Concern              | Old                                   | Rebuilt                                                                 |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Transaction owner    | belongs to `Account`                  | belongs to **`User`**; `accountId` nullable, **`onDelete: SetNull`**    |
| Account deletion     | **cascade-deletes** its transactions  | only unlinks them (`SetNull`) — history always survives                 |
| Income               | implicit ("amount > 0")               | explicit **`kind`** field on every transaction                         |
| Account identity     | volatile Akahu `_id`                  | stable bank **account number**, falling back to `akahuId`              |
| Transaction dedup    | `externalId` only                     | `externalId` **OR** Akahu `hash` **OR** (account + date + amount + desc) |

The `kind` field also fixes a latent bug: a transfer between the user's own accounts (a positive
credit) used to count as budgetable income and inflate "Available to Budget." `transfer` is excluded
from budgeting entirely.

### Entities

**User** — `id`, `email`, `createdAt`, `lastActiveAt`. Owns everything below.

**UserSettings** — `id`, `userId` (unique), `initialSyncDays` (default 30, how far back the first
Akahu sync reaches), display/theme prefs. _Removed_: all budget-cycle fields. _Note_: Akahu tokens
live in environment variables for this personal app, not in the DB.

**Account** — a connected bank account.
`id`, `userId`, `akahuId`, `accountNumber` (the stable formatted account number, e.g.
`12-1234-1234567-00`), `name`, `institution`, `accountType`, `balanceCurrent?`, `balanceAvailable?`,
`currency` (default `NZD`), `status`, `connectionLogo?`, `lastSyncAt?`, `connectionError?`,
timestamps.
**Identity resolution on sync:** match on `(userId, accountNumber)` when an account number is
present, else `(userId, akahuId)`. Reconnection therefore updates the existing row instead of
creating a duplicate. Deleting an account **never** deletes transactions.

**BucketGroup** — `id`, `userId`, `name`, `sortOrder`, `isCollapsed` (default false), timestamps.

**Bucket** — a cat piggy bank.
`id`, `groupId`, `name`, `icon?`, `color` (default indigo), `targetAmount?` (optional goal; drives
the fill gauge and savings-style progress), `topUpAmount` (default 0; the amount a single "feed"
adds and what "Feed All" uses), `sortOrder`, `isArchived` (default false, soft delete), timestamps.
_Removed_: `type`, `rollover`, `rolloverTargetId`.

**Transaction** — the durable ledger record.
`id`, `userId` (owner), `accountId?` (`SetNull`), `source` (`akahu` | `manual`), `externalId?`
(unique, Akahu txn id), `hash?` (Akahu dedup hash), `kind` (`income` | `expense` | `transfer`),
`amount` (Decimal, signed: negative = outflow, positive = inflow), `merchant?`, `description?`,
`date`, `category?` (Akahu-provided), `balanceAfter?`, `status` (`pending` | `confirmed`),
`isReclassified` (user overrode the auto `kind`), timestamps.
Indexes on `userId`, `date`, `status`, `accountId`.

**Allocation** — an expense (or refund) assigned to a bucket. Supports splits.
`id`, `transactionId`, `bucketId`, `amount` (Decimal, signed — carries the transaction's sign).
Unique `(transactionId, bucketId)`. Sum of a transaction's allocations must equal its amount.

**BudgetAllocation** ("feed") — money stuffed from the income pool into a bucket.
`id`, `userId`, `bucketId`, `amount` (positive Decimal), `note?`, `createdAt`. A feed is reversible
by deleting the row.

**CategorizationRule** — `id`, `userId`, `bucketId`, `merchantPattern`, `createdAt`. Unique
`(userId, merchantPattern)`.

_Removed entirely_: `ScheduledTransaction`.

## 5. Money model & interactions

### Calculations (all-time; no period resets)

- **Available to Budget** = `sum(transactions where kind = income) − sum(BudgetAllocations)`.
  Income is now durable user-owned rows, so it cannot silently vanish.
- **Bucket balance** = `sum(feeds into bucket) + sum(allocations to bucket)`. Expense allocations are
  negative and reduce the balance; a refund is a positive-amount expense allocated back to a bucket
  and increases it.
- **Fill level** (cat gauge) = `balance / targetAmount` when a target is set; otherwise the cat shows
  a simple "has money / empty" state.

### Classification

On sync, `kind` is auto-set from the Akahu transaction type and sign (`DEBIT` → `expense`, `CREDIT`
→ `income`, `TRANSFER` → `transfer`). The user can reclassify any transaction in the inbox
(`isReclassified` records the override). Only `expense` transactions appear in the inbox awaiting
allocation; `income` flows to the Available-to-Budget pool; `transfer` is hidden from budgeting.

### Cash stuffing (tap-based — no drag)

1. Income lands → Available-to-Budget pool grows.
2. **Feed one bucket**: tap a bucket (or its feed control) → adds its `topUpAmount` (or a custom
   amount entered in a small modal) → sparkle animation, pool decreases.
3. **Feed All**: one button feeds every bucket its `topUpAmount` → cascading sparkles across buckets.
4. **Completion**: confetti when Available-to-Budget reaches \$0.
5. Feeding is blocked from making Available-to-Budget negative.

### Allocation (inbox)

Tap an expense → pick a bucket, or split across several buckets (the allocation modal enforces that
the split sums to the transaction amount). Optionally "Always allocate \<merchant\> to \<bucket\>"
creates a CategorizationRule; future matching transactions auto-allocate on sync.

### Reordering (tap-based — no drag)

Group and bucket order is edited via move up/down controls (or a dedicated reorder mode), persisting
a new `sortOrder` via the reorder endpoints.

### Overspending

A bucket may go negative. Allowed, but shown with a prominent visual warning.

## 6. Local-first architecture (the speed fix)

Pages become **cache-first client views** instead of server-component DB queries.

```
Navigate → read IndexedDB cache (instant paint from last-known data)
         → fetch /api/… in background
         → reconcile + update UI + re-cache
Mutate   → optimistic UI → (queue if offline) → POST → reconcile on success/rollback on failure
Bank sync → explicit pull-to-refresh (unchanged)
```

- **TanStack Query + an IndexedDB persister** provides stale-while-revalidate, background refetch,
  optimistic mutations, and an offline mutation queue. It **replaces** the hand-rolled `offline/`
  hooks, sync queue, and manual cache calls — a net reduction in custom code.
- Next.js **API routes remain the sync layer** (REST, see §7).
- **Auth stays server-side** (middleware + Supabase). The login flow is server-rendered.
- Initial load is a fast app shell + skeletons, hydrated instantly from cache — so Vercel
  cold-starts and Supabase latency leave the critical path.

## 7. API design

REST endpoints under `/api`, all auth-scoped to the current user. Mutations return the updated
resource so the client can reconcile its cache.

| Area         | Endpoints                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------- |
| Buckets      | `GET/POST /buckets`, `PATCH/DELETE /buckets/:id`, `POST /buckets/reorder`                  |
| Groups       | `GET/POST /bucket-groups`, `PATCH/DELETE /bucket-groups/:id`, `POST /bucket-groups/reorder`|
| Transactions | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id` (incl. reclassify `kind`)       |
| Inbox        | `GET /inbox/count`                                                                         |
| Allocations  | `POST /transactions/:id/allocate`, `DELETE /transactions/:id/allocations/:bucketId`        |
| Budget       | `GET /budget/available`, `POST /budget/allocations`, `POST /budget/allocations/batch` (Feed All), `DELETE /budget/allocations/:id` |
| Accounts     | `GET /accounts`, `POST /accounts` (sync from Akahu), `DELETE /accounts/:id`, `POST /accounts/:id/refresh` |
| Sync         | `POST /transactions/sync` (pull-to-refresh; dedup + auto-categorize)                       |
| Rules        | `GET/POST /rules`, `DELETE /rules/:id`                                                     |
| Settings     | `GET/PATCH /settings`                                                                      |

_Removed_: all `/scheduled*` endpoints.

## 8. Akahu integration & hardening

- **Auth**: personal-app token auth (`AKAHU_APP_TOKEN` + `AKAHU_USER_TOKEN` from env), as today.
- **Stable account identity** and **robust dedup** as defined in §4 — reconnection updates rather
  than duplicates, and reissued transaction IDs no longer create duplicates or orphans.
- **No destructive deletes**: removing an account unlinks transactions (`SetNull`); they remain in
  the ledger.
- **Full refresh** action: fetches a wide window and reconciles by dedup key, so historical gaps
  self-heal instead of being permanently lost to the narrow incremental window.
- **Pending transactions** are shown but clearly marked; confirmed versions reconcile onto the
  pending record via dedup.
- Sync failures surface a non-blocking warning banner; the app keeps working from cache.

## 9. PWA & offline

- Installable, app-shell cached by the service worker, icons + manifest retained.
- IndexedDB (via the TanStack Query persister) holds the last-known buckets, transactions, settings,
  and the offline mutation queue.
- Offline: reads serve from cache; mutations queue and flush automatically when back online.

## 10. Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 + Postgres (Supabase) ·
Supabase Auth (OTP) · Akahu (NZ open banking) · Motion (animations) · idb · **TanStack Query (new)**
· next-pwa. **Removed**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
Testing: Vitest (unit/integration) + Playwright (E2E). Hosting: Vercel + Supabase free tier.

## 11. Testing strategy

- **Unit** (Vitest): bucket-balance math, Available-to-Budget, split-allocation validation,
  transaction classification (`kind`), dedup/identity resolution, categorization-rule matching.
- **Integration** (Vitest): each API route — auth required, CRUD, error/edge cases (e.g. deleting an
  account preserves its transactions; reconnection updates instead of duplicating).
- **E2E** (Playwright, mobile viewport): cash-stuffing flow (tap-feed → sparkle → confetti at \$0),
  inbox allocation incl. split, manual entry, pull-to-refresh sync, offline mutation queue + flush.

## 12. Security & privacy

- OTP auth via Supabase; sessions expire after inactivity.
- All data encrypted at rest (Supabase default); HTTPS enforced (Vercel).
- Supabase Row-Level Security: users access only their own rows; all tables protected by default.
- Akahu tokens in environment variables only — never client-side, never in the DB.
- `.gitignore` excludes `.env*`, `*.pem`, `*.key`, and local Supabase secrets.

## 13. Data migration / first run

Greenfield: start with a clean database. The user re-creates their handful of buckets/groups and
re-syncs recent transactions from Akahu (within `initialSyncDays`). Old transaction history is not
migrated — income history was already lost, and a clean ledger validates the new durable model. (An
optional one-time export/import of just the bucket/group setup can be added if desired, but is not
planned for v1.)

## 14. Out of scope (future)

Reporting/analytics, data export (JSON/CSV), push notifications, multi-currency, shared/household
budgeting, receipt scanning, budget templates. None of these exist today; they remain future work.

## 15. Resolved decisions

1. **Paradigm** — envelope budgeting ("every dollar a job"), cash stuffing kept.
2. **Bucket model** — drop `savings`/`spending` type and rollover; use `targetAmount` + `topUpAmount`.
3. **Caching** — local-first, stale-while-revalidate, via TanStack Query + IndexedDB persister.
4. **Rebuild approach** — greenfield, port good code (cat components, Akahu client, animations), fresh DB.
5. **Drag** — removed entirely; cash stuffing and reordering are tap-based.
6. **Akahu** — kept, but hardened (stable identity, robust dedup, no destructive deletes, full refresh).
