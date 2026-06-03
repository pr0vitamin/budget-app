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

### UI vocabulary: Clowders & Cats

User-facing language is themed: a **Clowder** is a group of cats (model `BucketGroup`), and a **Cat**
is a single envelope (model `Bucket`). Only labels/copy use these terms — the data model, API
routes, and types keep `BucketGroup` / `Bucket`.

### Target user

Single user (personal use), New Zealand, multiple bank accounts, paid fortnightly. Not multi-tenant
in spirit, though auth still scopes all data per user.

## 3. Scope

### Kept

- Cats (buckets) organised into Clowders (groups), shown as cat piggy banks on the **Cats page**.
- Cash stuffing — tap-to-feed a cat, "Feed All", sparkle + confetti celebrations.
- Cat/Clowder create, edit, and reorder — on the Cats page behind a **Manage** toggle.
- **Transactions page**: lists all transactions; tap to allocate / re-allocate to cats (incl. splits);
  manual transaction entry lives here too.
- Auto-categorization rules (merchant → cat).
- Akahu bank sync via pull-to-refresh (personal-app token auth).
- Settings (initial sync days, theme, sign-out).
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

### New behaviour (added during review)

- **Auto-remainder on split** — when one bucket is left in a split, it auto-fills the remaining
  amount (see §5).
- **Durable pending allocations** — allocations survive the pending → confirmed lifecycle and any
  Akahu-side field changes; nothing is ever silently unallocated by a sync (see §4 `needsReview`, §8).
- **Instant feed animations** — sparkle/confetti fire immediately from optimistic local state, with
  no network or `router.refresh()` on the critical path (see §5).
- **Rules apply to pending** — categorization rules auto-allocate at ingestion for pending as well as
  confirmed expenses (see §5).

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
`isReclassified` (user overrode the auto `kind`), `needsReview` (an amount change or dropped-pending
left this transaction's allocations possibly out of date — surfaced to the user, never auto-wiped),
timestamps.
Indexes on `userId`, `date`, `status`, `accountId`.

**Allocation** — an expense (or refund) assigned to a bucket. Supports splits.
`id`, `transactionId`, `bucketId`, `amount` (Decimal, signed — carries the transaction's sign).
Unique `(transactionId, bucketId)`. Allocations must sum to the transaction amount **at allocation
time** (enforced by the allocation modal); a later Akahu-side amount change can break this, which
sets `needsReview` (§8) rather than silently editing the user's splits.

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
→ `income`, `TRANSFER` → `transfer`). The user can reclassify any transaction on the Transactions
page (`isReclassified` records the override). `expense` transactions are the ones that need
allocating (the Transactions page flags the unallocated ones, and the nav badges their count);
`income` flows to the Available-to-Budget pool; `transfer` is hidden from budgeting.

### Cash stuffing (tap-based — no drag)

1. Income lands → Available-to-Budget pool grows.
2. **Feed one cat**: tap the cat's **feed control** (a "＋ \$topUp" pill) → adds its `topUpAmount`
   → sparkle animation, pool decreases. (Tapping the cat *itself* opens its **details** — balance,
   activity, edit — not a feed; feeding is the deliberate pill tap. A custom amount is available via
   the "＋ Custom" modal in the header.)
3. **Feed All**: one button feeds every cat its `topUpAmount` → cascading sparkles across the cats.
4. **Completion**: confetti when Available-to-Budget reaches \$0.
5. Feeding is blocked from making Available-to-Budget negative.

**Instant feedback — no network on the critical path.** Today the sparkle/confetti fire only *after*
the feed POST completes _and_ a full server re-render (`router.refresh()`), so on a cold free-tier
server the animation lags badly. In the rebuild, a tap updates the bucket balance and
Available-to-Budget **optimistically in local state and fires the animation immediately** (target:
< 16 ms to first frame, never gated on the network). The POST runs in the background and reconciles
the cache on success, or rolls the balance back with an error toast on failure. **No
`router.refresh()` is ever on the animation path.** "Feed All" animates every cat in one pass from
the optimistic state, rather than waiting on the batch request.

### Allocation (Transactions page)

The Transactions page lists **all** transactions (allocated, unallocated, pending, income) with their
status; tapping one opens the allocation modal to allocate or re-allocate. Manual transaction entry
also lives on this page. Tap an expense → pick a cat, or split across several cats (the modal enforces
that the split sums to the transaction amount). Optionally "Always allocate \<merchant\> to \<cat\>"
creates a CategorizationRule; future matching expense transactions auto-allocate on sync.

**Rules apply to pending transactions too.** Categorization runs the moment an expense is ingested —
whether it arrives **pending or confirmed** — so a known merchant lands in its bucket immediately
rather than waiting days for confirmation. Akahu does not enrich pending transactions (no merchant
object, only a raw description), so pending matching runs against the description-derived merchant
using the same case-insensitive substring match the rules already use. The auto-allocation then
rides through the pending → confirmed lifecycle (§8): it is preserved, and its amount is updated if
the confirmed total differs. Matching is idempotent — a transaction that already has an allocation
(auto or manual) is never re-allocated.

**Auto-remainder on split.** The modal always shows a running "remaining to allocate" figure. When
exactly **one** chosen bucket still has no amount entered, that bucket's amount auto-fills with the
remainder and stays in sync as the other amounts change — so the user never hand-calculates the last
split. With two or more buckets still unentered, no auto-fill happens (there is no unambiguous
remainder). Example: a \$12.90 supermarket transaction split across Pet and Groceries — entering
\$4.50 for Pet auto-assigns \$8.40 to Groceries.

### Cat & Clowder management (Cats page, Manage mode)

The Cats page has a **Manage** toggle. In its default (feed) mode, each cat shows a feed pill
("＋ \$topUp") and tapping the cat opens its **details** (balance, activity feed via
`GET /api/buckets/:id`, and an edit affordance). Switching to Manage mode reveals: create a Clowder,
add Cats to a Clowder, edit/delete a Cat, and **reorder**
cats and clowders via tap move-up/down controls (no drag) — persisting `sortOrder` through the
reorder endpoints. Keeping management behind a toggle preserves the primary tap-to-feed gesture.

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
| Buckets      | `POST /buckets`, `GET/PATCH/DELETE /buckets/:id` (GET = activity feed), `POST /buckets/reorder` |
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
- Sync failures surface a non-blocking warning banner; the app keeps working from cache.

### Pending transaction lifecycle (allocations must survive)

Pending transactions are allocatable and shown but clearly marked. Akahu pending transactions have
**no stable ID** and mutate as they settle (amount, description, and date all change), so the old
delete-and-recreate-by-key approach destroyed allocations on nearly every sync. The rebuilt rules:

- **Reconcile in place, never delete-and-recreate.** Each real-world transaction maps to one stable
  local row that allocations hang off. On sync, a pending Akahu transaction is matched to its
  existing row via the §4 dedup machinery (Akahu `hash` if present, else account + approximate date
  + amount-within-tolerance + description similarity) and **updated in place** — even if amount or
  description has changed. The row id, and therefore its allocations, are preserved.
- **Pending → confirmed preserves allocations.** When the confirmed version arrives it reconciles
  onto the same row (flip `status` to `confirmed`, set `externalId`/`hash`), keeping allocations:
  - **Single allocation**: update the allocation amount to the confirmed total, preserving the
    bucket choice.
  - **Split (multiple allocations)**: **never delete.** Keep the existing splits; if they no longer
    sum to the new amount, set `needsReview` and surface the transaction on the Transactions page so the user
    adjusts it — the auto-remainder feature (§5) makes that a one-tap fix.
- **Disappearing pending.** If Akahu stops reporting a pending transaction: remove the local row
  only if it has **no allocations** (a transient pre-auth that vanished). If it has allocations,
  keep it and set `needsReview` rather than destroying the user's intent — pending holds often
  reappear as a confirmed transaction with a different key.
- **Net effect:** allocating a pending transaction is safe; nothing the user assigns is ever silently
  unallocated by a sync. The only outcome of an Akahu-side change is, at worst, a `needsReview` flag.

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
  Transactions-page allocation incl. split, manual entry, pull-to-refresh sync, offline mutation queue + flush.

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
7. **UI revision (from live testing, post-Phase-2)** — themed vocabulary **Clowder** (group) / **Cat**
   (bucket), labels only; Cat/Clowder create + edit + reorder moved onto the **Cats page** behind a
   Manage toggle; the old Inbox became the **Transactions page** (all transactions, allocate inline,
   manual entry here); Settings trimmed accordingly.
