# 🐱 Bucket Budget - Project Plan

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

- [ ] Configure Supabase Auth for magic link
- [ ] Create login page with email input
- [ ] Implement magic link request flow
- [ ] Set up session handling (7-day inactivity timeout)
- [ ] Create auth middleware for protected routes
- [ ] Add auth context provider

#### 1.4 Base Layout & Navigation

- [ ] Create mobile-first responsive layout
- [ ] Add bottom navigation bar (Buckets, Inbox, Calendar, Settings)
- [ ] Implement skeleton loading states
- [ ] Set up error boundary

#### 1.5 Testing Infrastructure

- [ ] Configure Vitest for unit tests
- [ ] Configure Playwright for E2E tests
- [ ] Create test database/environment
- [ ] Set up test authentication helpers

### Milestone 1 Deliverable

✅ User can sign up/login via magic link and see an empty dashboard

---

## Milestone 2: Core Data & Visuals

**Goal**: CRUD for buckets and manual transactions, with personality

### Tasks

#### 2.1 Bucket Groups API & UI

- [ ] `GET /api/bucket-groups` - list groups
- [ ] `POST /api/bucket-groups` - create group
- [ ] `PATCH /api/bucket-groups/:id` - update group
- [ ] `DELETE /api/bucket-groups/:id` - delete group
- [ ] `POST /api/bucket-groups/reorder` - reorder groups
- [ ] Create bucket group management UI
- [ ] Implement drag-and-drop reordering

#### 2.2 Buckets API & UI

- [ ] `GET /api/buckets` - list buckets with calculated balances
- [ ] `POST /api/buckets` - create bucket
- [ ] `PATCH /api/buckets/:id` - update bucket
- [ ] `DELETE /api/buckets/:id` - delete bucket
- [ ] `POST /api/buckets/reorder` - reorder within groups
- [ ] Create bucket list view (grouped, collapsible)
- [ ] Create bucket form (name, type, color, icon, rollover settings)
- [ ] Display balance calculations

#### 2.3 Cat Piggy Bank Component

- [ ] Design cat-face piggy bank SVG/component
- [ ] Implement fill-level visualization
- [ ] Add basic tap interaction (subtle bounce)
- [ ] Create color variants
- [ ] Basic fill animation (simple transition, not fancy yet)
- [ ] Overspending state (visual warning)

#### 2.4 Manual Transactions

- [ ] `POST /api/transactions` - create manual transaction
- [ ] `PATCH /api/transactions/:id` - update transaction
- [ ] `DELETE /api/transactions/:id` - delete manual transaction
- [ ] Create add transaction form (amount, merchant, date, account)
- [ ] Create transaction list view

#### 2.5 User Settings

- [ ] `GET /api/settings` - get user settings
- [ ] `PATCH /api/settings` - update settings
- [ ] Create settings page
- [ ] Budget cycle configuration (type, start day)

#### 2.6 Unit Tests - Core Logic

- [ ] Test bucket balance calculation
- [ ] Test period boundary calculations
- [ ] Test rollover logic

### Milestone 2 Deliverable

✅ User can create buckets/groups with cute cat visuals, add manual transactions, configure budget cycle

---

## Milestone 3: Allocation

**Goal**: Allocate transactions to buckets, split transactions, auto-categorization

### Tasks

#### 3.1 Allocation API

- [ ] `POST /api/transactions/:id/allocate` - allocate to bucket(s)
- [ ] `DELETE /api/transactions/:id/allocate` - remove allocation
- [ ] Handle split transactions (multiple allocations)
- [ ] Validate sum of splits equals transaction amount

#### 3.2 Inbox View

- [ ] `GET /api/transactions/inbox` - unallocated transactions
- [ ] Create inbox page with transaction cards
- [ ] Show unallocated count in navigation badge
- [ ] Implement swipe-to-allocate gesture

#### 3.3 Transaction Allocation UI

- [ ] Create allocation modal/sheet
- [ ] Bucket selector with search
- [ ] Split transaction interface
- [ ] "Always allocate [merchant] to [bucket]" toggle

#### 3.4 Categorization Rules

- [ ] `GET /api/rules` - list rules
- [ ] `POST /api/rules` - create rule
- [ ] `DELETE /api/rules/:id` - delete rule
- [ ] Auto-apply rules on new transactions
- [ ] Rules management UI

#### 3.5 Available to Budget

- [ ] Calculate unallocated income
- [ ] Display prominently on buckets page
- [ ] Prevent over-allocation (validation)

#### 3.6 Unit Tests - Allocation Logic

- [ ] Test split transaction validation
- [ ] Test auto-categorization rule matching
- [ ] Test available-to-budget calculation

### Milestone 3 Deliverable

✅ User can allocate transactions to buckets, create rules, see inbox

---

## Milestone 4: Bank Integration

**Goal**: Connect to Akahu, sync transactions, handle amendments

### Tasks

#### 4.1 Akahu OAuth Flow

- [ ] `POST /api/accounts/connect` - initiate OAuth
- [ ] `GET /api/accounts/callback` - handle callback
- [ ] Store encrypted tokens in UserSettings
- [ ] Read-only scope verification

#### 4.2 Account Management

- [ ] `GET /api/accounts` - list connected accounts
- [ ] `DELETE /api/accounts/:id` - disconnect account
- [ ] Account list UI with institution logos
- [ ] Connection status indicators

#### 4.3 Transaction Sync

- [ ] `POST /api/accounts/:id/sync` - trigger manual sync
- [ ] Fetch transactions from Akahu
- [ ] Deduplicate by externalId
- [ ] Map Akahu transaction fields to our schema
- [ ] Apply categorization rules to new transactions
- [ ] Pull-to-refresh on transaction lists
- [ ] 1-hour rate limit enforcement

#### 4.4 Transaction Amendment Handling

- [ ] Detect amended transactions on sync
- [ ] Single-bucket allocation: keep allocation, flag as amended
- [ ] Multi-bucket split: unallocate, notify user
- [ ] Amended transaction UI indicator
- [ ] Amendment notification

#### 4.5 Sync Status UI

- [ ] Last sync timestamp per account
- [ ] Sync in progress indicator
- [ ] Error banner for sync failures
- [ ] Rate limit countdown

#### 4.6 Integration Tests - Akahu

- [ ] Test OAuth flow with mock Akahu
- [ ] Test transaction sync
- [ ] Test amendment detection

### Milestone 4 Deliverable

✅ User can connect bank, sync transactions, amendments handled

---

## Milestone 5: Scheduling & Calendar

**Goal**: Scheduled transactions, calendar view, auto-matching

### Tasks

#### 5.1 Scheduled Transactions API

- [ ] `GET /api/scheduled` - list scheduled transactions
- [ ] `POST /api/scheduled` - create scheduled transaction
- [ ] `PATCH /api/scheduled/:id` - update scheduled
- [ ] `DELETE /api/scheduled/:id` - delete scheduled
- [ ] Calculate next due date based on frequency

#### 5.2 Scheduled Transaction UI

- [ ] Create/edit scheduled transaction form
- [ ] Frequency selector (weekly, fortnightly, monthly, yearly, custom)
- [ ] List of scheduled transactions

#### 5.3 Auto-Matching

- [ ] Match incoming transactions to scheduled transactions
- [ ] ±10% amount tolerance
- [ ] ±3 day date tolerance
- [ ] Auto-link and mark as fulfilled
- [ ] Handle matching conflicts

#### 5.4 Bucket Reserved Amounts

- [ ] Calculate upcoming scheduled amounts per bucket
- [ ] Display "Available now" vs "Total balance"
- [ ] Visual indicator for reserved funds

#### 5.5 Calendar View

- [ ] Weekly calendar grid
- [ ] Swipe navigation between weeks
- [ ] Display scheduled transactions on due dates
- [ ] Display pay days
- [ ] Color-code by bucket group
- [ ] Tap to view/edit scheduled transaction
- [ ] Fulfilled vs pending visual distinction

#### 5.6 Unit Tests - Scheduling Logic

- [ ] Test next due date calculation
- [ ] Test transaction matching (±10%, ±3 days)
- [ ] Test reserved amount calculation

### Milestone 5 Deliverable

✅ User can schedule recurring transactions, view calendar, auto-matching works

---

## Milestone 6: Animations & Delight

**Goal**: Cash stuffing animations, polish, and visual delight

### Tasks

#### 6.1 Cash Stuffing Animations

- [ ] Integrate Motion (Framer Motion) library
- [ ] Drag-and-drop from money pool to buckets
- [ ] Allocate pre-configured amount on drop
- [ ] Sparkle animation on allocation
- [ ] Quick Allocate All button with cascading animation
- [ ] Completion confetti celebration
- [ ] Spring physics for jar interactions

#### 6.2 Cat Piggy Bank Polish

- [ ] Refine cat-face design with more expressions
- [ ] Liquid/coins fill animation upgrade
- [ ] Angry cat for overspending
- [ ] Happy cat for savings goal progress
- [ ] Wobble animation when full

#### 6.3 Dark Mode

- [ ] Define dark color palette
- [ ] CSS custom property theming
- [ ] System preference detection
- [ ] Manual toggle in settings

#### 6.4 Micro-Interactions

- [ ] Loading skeletons everywhere
- [ ] Empty states with personality
- [ ] Transition animations between views
- [ ] Pull-to-refresh animation

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
