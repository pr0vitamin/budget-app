# 🐱 Cat Budget - Project Plan

A phased implementation plan breaking down the spec into logical milestones and bite-sized tasks.

---

## Overview

The project is organized into **7 milestones**, each building on the previous. Each milestone delivers a usable increment of the application.

| Milestone | Name                  | Description                                           |
| --------- | --------------------- | ----------------------------------------------------- |
| M1        | Foundation            | Project setup, auth, database                         |
| M2        | Core Data & Visuals   | Buckets, groups, cat piggy banks, manual transactions |
| M3        | Allocation            | Transaction allocation, rules, inbox                  |
| M4        | Bank Integration      | Akahu connection, sync, matching                      |
| M5        | Scheduling & Calendar | Scheduled transactions, calendar view                 |
| M6        | Animations & Delight  | Cash stuffing, sparkles, confetti, dark mode          |
| M7        | Production Readiness  | PWA, notifications, reporting, E2E tests              |

---

## Milestone 1: Foundation

**Goal**: Deployable app with authentication and database schema

### Tasks

#### 1.1 Project Initialization

- [x] Create Next.js 16 app with App Router
- [x] Configure TypeScript strict mode
- [x] Set up Tailwind CSS 4.x with CSS-first config
- [x] Configure ESLint + Prettier
- [x] Create `.gitignore` (exclude `.env*`, `*.pem`, `*.key`, etc.)
- [x] Initialize Git repository

#### 1.2 Database Setup

- [x] Create Supabase project
- [x] Initialize Prisma with PostgreSQL
- [x] Define schema for all entities:
  - User, Account, BucketGroup, Bucket
  - Transaction, Allocation
  - ScheduledTransaction, CategorizationRule
  - UserSettings
- [x] Run initial migration
- [x] Enable Row-Level Security (RLS) policies

#### 1.3 Authentication

- [x] Configure Supabase Auth for magic link
- [x] Create login page with email input
- [x] Implement magic link request flow
- [x] Set up session handling (7-day inactivity timeout)
- [x] Create auth middleware for protected routes
- [x] Add auth context provider

#### 1.4 Base Layout & Navigation

- [x] Create mobile-first responsive layout
- [x] Add bottom navigation bar (Buckets, Inbox, Calendar, Settings)
- [x] Implement skeleton loading states
- [x] Set up error boundary

#### 1.5 Testing Infrastructure

- [x] Configure Vitest for unit tests
- [x] Configure Playwright for E2E tests
- [x] Create test database/environment
- [x] Set up test authentication helpers

### Milestone 1 Deliverable

✅ User can sign up/login via magic link and see an empty dashboard

---

## Milestone 2: Core Data & Visuals

**Goal**: CRUD for buckets and manual transactions, with personality

### Tasks

#### 2.1 Bucket Groups API & UI

- [x] `GET /api/bucket-groups` - list groups
- [x] `POST /api/bucket-groups` - create group
- [x] `PATCH /api/bucket-groups/:id` - update group
- [x] `DELETE /api/bucket-groups/:id` - delete group
- [x] `POST /api/bucket-groups/reorder` - reorder groups
- [x] Create bucket group management UI
- [x] Implement drag-and-drop reordering

#### 2.2 Buckets API & UI

- [x] `GET /api/buckets` - list buckets with calculated balances
- [x] `POST /api/buckets` - create bucket
- [x] `PATCH /api/buckets/:id` - update bucket
- [x] `PATCH /api/buckets/:id` - update bucket
- [ ] `DELETE /api/buckets/:id` - soft delete bucket (rename, hide, keep history)
- [x] `POST /api/buckets/reorder` - reorder within groups
- [x] Create bucket list view (grouped, collapsible)
- [x] Create bucket form (name, type, color, icon, rollover settings)
- [x] Display balance calculations

#### 2.3 Cat Piggy Bank Component

- [x] Design cat-face piggy bank SVG/component
- [x] Implement fill-level visualization
- [x] Add basic tap interaction (subtle bounce)
- [x] Create color variants
- [x] Basic fill animation (simple transition, not fancy yet)
- [x] Overspending state (visual warning)

#### 2.4 Manual Transactions

- [x] `POST /api/transactions` - create manual transaction
- [x] `PATCH /api/transactions/:id` - update transaction
- [x] `DELETE /api/transactions/:id` - delete manual transaction
- [x] Create add transaction form (amount, merchant, date, account)
- [x] Create transaction list view

#### 2.5 User Settings

- [x] `GET /api/settings` - get user settings
- [x] `PATCH /api/settings` - update settings
- [x] Create settings page
- [x] Budget cycle configuration (type, start day)

#### 2.6 Unit Tests - Core Logic

- [x] Test bucket balance calculation
- [x] Test period boundary calculations
- [x] Test rollover logic

### Milestone 2 Deliverable

✅ User can create buckets/groups with cute cat visuals, add manual transactions, configure budget cycle

---

## Milestone 3: Allocation

**Goal**: Allocate transactions to buckets, split transactions, auto-categorization

### Tasks

#### 3.1 Allocation API

- [x] `POST /api/transactions/:id/allocate` - allocate to bucket(s)
- [x] `DELETE /api/transactions/:id/allocate` - remove allocation
- [x] Handle split transactions (multiple allocations)
- [x] Validate sum of splits equals transaction amount

#### 3.2 Inbox View

- [x] `GET /api/transactions/inbox` - unallocated transactions
- [x] Create inbox page with transaction cards
- [x] Show unallocated count in navigation badge
- [x] Implement swipe-to-allocate gesture

#### 3.3 Transaction Allocation UI

- [x] Create allocation modal/sheet
- [x] Bucket selector with search
- [x] Split transaction interface
- [x] "Always allocate [merchant] to [bucket]" toggle

#### 3.4 Categorization Rules

- [x] `GET /api/rules` - list rules
- [x] `POST /api/rules` - create rule
- [x] `DELETE /api/rules/:id` - delete rule
- [x] Auto-apply rules on new transactions
- [x] Rules management UI

#### 3.5 Available to Budget

- [x] Calculate unallocated income
- [x] Display prominently on buckets page
- [x] Prevent over-allocation (validation)

#### 3.6 Unit Tests - Allocation Logic

- [x] Test split transaction validation
- [x] Test auto-categorization rule matching
- [x] Test available-to-budget calculation

### Milestone 3 Deliverable

✅ User can allocate transactions to buckets, create rules, see inbox

---

## Milestone 4: Bank Integration

**Goal**: Connect to Akahu, sync transactions, handle amendments

### Tasks

#### 4.1 Akahu Personal App Integration

- [x] Create `akahu.ts` API client (personal app tokens, no OAuth)
- [x] Typed interfaces for accounts/transactions
- [x] Update `.env.example` with required tokens

#### 4.2 Account Management

- [x] `GET /api/accounts` - list connected accounts
- [x] `POST /api/accounts` - sync accounts from Akahu
- [x] Account list UI with institution logos
- [x] Connection status indicators

#### 4.3 Transaction Sync

- [x] `POST /api/accounts/:id/sync` - trigger manual sync
- [x] Fetch transactions from Akahu
- [x] Deduplicate by externalId
- [x] Map Akahu transaction fields to our schema
- [x] Apply categorization rules to new transactions
- [x] Pull-to-refresh on transaction lists
- [x] 1-hour rate limit enforcement

#### 4.4 Transaction Amendment Handling

- [x] Detect amended transactions on sync
- [x] Single-bucket allocation: keep allocation, flag as amended
- [x] Multi-bucket split: unallocate, add to inbox
- [x] Amended transaction UI indicator
- [ ] Amendment notification (future: push notifications)

#### 4.5 Sync Status UI

- [x] Last sync timestamp per account
- [x] Sync in progress indicator
- [x] Error banner for sync failures
- [x] Rate limit countdown

#### 4.6 Integration Tests - Akahu

- [x] ~~Test OAuth flow with mock Akahu~~ (Not applicable - using personal app)
- [x] Test transaction sync
- [x] Test amendment detection

### Milestone 4 Deliverable

✅ User can connect bank, sync transactions, amendments handled

---

## Milestone 5: Scheduling & Calendar

**Goal**: Scheduled transactions, calendar view, auto-matching

### Tasks

#### 5.1 Scheduled Transactions API

- [x] `GET /api/scheduled` - list scheduled transactions
- [x] `POST /api/scheduled` - create scheduled transaction
- [x] `PATCH /api/scheduled/:id` - update scheduled
- [x] `DELETE /api/scheduled/:id` - delete scheduled
- [x] Calculate next due date based on frequency

#### 5.2 Scheduled Transaction UI

- [x] Create/edit scheduled transaction form
- [x] Frequency selector (weekly, fortnightly, monthly, yearly, custom)
- [x] List of scheduled transactions

#### 5.3 Auto-Matching

- [x] Match incoming transactions to scheduled transactions
- [x] ±20% amount tolerance (updated from ±10%)
- [x] ±5 day date tolerance (updated from ±3 days)  
- [x] Auto-link and mark as fulfilled
- [x] Handle matching conflicts (prefer closer dates)

#### 5.4 Bucket Reserved Amounts

- [x] Calculate upcoming scheduled amounts per bucket
- [x] Display "Available now" vs "Total balance"
- [x] Visual indicator for reserved funds

#### 5.5 Calendar View (Moved to Future Enhancement)

- [ ] Weekly calendar grid
- [ ] Swipe navigation between weeks
- [ ] Display scheduled transactions on due dates
- [ ] Display pay days
- [ ] Color-code by bucket group
- [ ] Tap to view/edit scheduled transaction
- [ ] Fulfilled vs pending visual distinction

#### 5.6 Unit Tests - Scheduling Logic

- [x] Test next due date calculation
- [x] Test transaction matching (±20%, ±5 days)
- [x] Test reserved amount calculation

### Milestone 5 Deliverable

✅ User can schedule recurring transactions, auto-matching works, reserved amounts shown

---

## Milestone 6: Animations & Delight

**Goal**: Cash stuffing animations, polish, and visual delight

### Tasks

#### 6.1 Cash Stuffing Animations

- [x] ~~Drag-and-drop from money pool to buckets~~ (Simplified to "Feed All" button)
- [x] "Feed all the cats!" button with confirmation modal
- [x] Allocate pre-configured amounts on confirm
- [x] Sparkle animation component (SparkleEffect)
- [x] Completion confetti celebration (ConfettiCelebration)
- [x] Spring physics for cat interactions (Motion library)

#### 6.2 Cat Piggy Bank Polish

- [x] Refine cat-face design with Kawaii style
- [x] Liquid fill animation
- [x] Angry cat expression for overspending
- [x] Happy cat expression when full
- [x] Rounded ears and 3 whiskers
- [ ] Wobble animation when full

#### 6.3 Dark Mode

- [ ] Define dark color palette
- [ ] CSS custom property theming
- [ ] System preference detection
- [ ] Manual toggle in settings

#### 6.4 Micro-Interactions

- [x] Loading skeletons for all pages
- [x] ~~Empty states with personality~~ (existing states sufficient)
- [x] ~~Transition animations between views~~ (CSS animate-in already in use)
- [x] ~~Pull-to-refresh animation~~ (skipped - not needed)

### Milestone 6 Deliverable

✅ App feels delightful and polished with personality throughout

---

## Milestone 7: Production Readiness

**Goal**: PWA, notifications, reporting, final testing

### Tasks

#### 7.1 PWA Setup

- [ ] Create web manifest
- [ ] Configure service worker (Workbox)
- [ ] Cache shell and static assets
- [ ] Offline mode (read-only transaction viewing)
- [ ] Background sync for pending actions
- [ ] Install prompt UI

#### 7.2 Push Notifications

- [ ] Set up web push (VAPID keys)
- [ ] Notification permission flow
- [ ] Uncategorized transactions notification
- [ ] Upcoming scheduled transaction reminders
- [ ] Overspending alerts

#### 7.3 Reporting & Analytics

- [ ] `GET /api/reports/spending` - spending data endpoint
- [ ] Spending by bucket over time
- [ ] Spending by bucket group
- [ ] Configurable time windows
- [ ] Bar charts / visualizations

#### 7.4 Data Export

- [ ] `GET /api/export?format=json` - full JSON export
- [ ] `GET /api/export?format=csv` - CSV export
- [ ] Export UI in settings

#### 7.5 E2E Tests - Critical Flows

- [ ] Allocation flow test
- [ ] Bank sync flow test
- [ ] Scheduled transaction flow test
- [ ] Cash stuffing flow test

#### 7.6 Final Polish

- [ ] Error handling and recovery
- [ ] Accessibility audit (a11y)
- [ ] Performance optimization
- [ ] Mobile gesture refinement

### Milestone 7 Deliverable

✅ Fully production-ready PWA with notifications and reporting

---

## Verification Strategy

### Continuous Testing

- **Unit tests**: Run on every commit via `npm run test`
- **Type checking**: `npm run typecheck` (strict mode)
- **Linting**: `npm run lint`

### Milestone Verification

| Milestone | Verification                                                |
| --------- | ----------------------------------------------------------- |
| M1        | Login via magic link works, database tables exist           |
| M2        | Create bucket with cat visual, add transaction, see in list |
| M3        | Allocate transaction, verify bucket balance updates         |
| M4        | Connect mock/real bank, sync transactions                   |
| M5        | Create schedule, verify calendar, test matching             |
| M6        | Cash stuffing animations work, dark mode toggles            |
| M7        | Full E2E suite passes, PWA installs, notifications work     |

### Commands

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Type check
npm run typecheck

# Lint
npm run lint

# Full verification
npm run verify  # runs lint, typecheck, test, test:e2e
```

---

## Risk Areas

| Risk                                  | Mitigation                                           |
| ------------------------------------- | ---------------------------------------------------- |
| Akahu API changes                     | Abstract behind service layer, good error handling   |
| Animation performance on older phones | Test on low-end devices, use `will-change` sparingly |
| PWA caching issues                    | Clear versioning strategy, manual cache bust option  |
| Supabase free tier limits             | Monitor usage, optimize queries                      |

---

## Success Criteria

The project is complete when:

1. ✅ User can sign up and log in via magic link
2. ✅ User can connect their NZ bank via Akahu
3. ✅ Transactions sync and appear in inbox
4. ✅ User can allocate transactions to buckets (single or split)
5. ✅ Auto-categorization rules work
6. ✅ Scheduled transactions appear in calendar
7. ✅ Scheduled transactions auto-match with bank transactions
8. ✅ Cash stuffing with drag-drop and animations is delightful
9. ✅ App installs as PWA and works offline (read-only)
10. ✅ Notifications work for key events
11. ✅ Reporting shows spending over time
12. ✅ All E2E tests pass

---

_Last updated: January 2026_
