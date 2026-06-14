import { describe, it, expect } from 'vitest';
import {
  decideSyncAction,
  decideDisappearedPending,
  confirmedFieldsDiffer,
  firstConnectCutoff,
  matchPendingRow,
  reconcileAllocations,
  STALE_PENDING_DAYS,
  type ConfirmedFields,
  type ExistingTxn,
  type PendingCandidate,
} from './reconcile';

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

  it('matches by externalId regardless of how old the existing row is (identity beats date)', () => {
    // The candidate set must surface an externalId-bearing row even when its date
    // is far outside the recent window — otherwise we try to re-insert a unique
    // externalId and abort the sync. This locks that identity match is date-free.
    const existing = [base({ id: 'e1', externalId: 'a1', status: 'confirmed', date: new Date('2020-01-01') })];
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

  it('confirms a fuzzily-matched pending transaction (no ids on pending, same amount/desc)', () => {
    const existing = [base({ id: 'p1', status: 'pending', amount: -1, description: 'Cafe Hold' })];
    expect(
      decideSyncAction({ externalId: 'a9', hash: 'h9', date: new Date('2026-05-01'), amount: -1, description: 'Cafe Hold' }, existing)
    ).toEqual({ type: 'confirm', id: 'p1' });
  });

  it('does NOT confirm a pending whose settled amount drifted (no pre-auth tolerance)', () => {
    // Same merchant/day but $1.00 pending vs $1.05 settled → treated as distinct.
    const existing = [base({ id: 'p1', status: 'pending', amount: -1, description: 'Cafe Hold' })];
    expect(
      decideSyncAction({ externalId: 'a9', hash: 'h9', date: new Date('2026-05-01'), amount: -1.05, description: 'Cafe Hold' }, existing)
    ).toEqual({ type: 'create' });
  });

  it('confirms (not updates) when an id match is still pending', () => {
    const existing = [base({ id: 'p2', externalId: 'a1', status: 'pending' })];
    expect(
      decideSyncAction({ externalId: 'a1', hash: null, date: new Date('2026-05-01'), amount: -10, description: 'Countdown' }, existing)
    ).toEqual({ type: 'confirm', id: 'p2' });
  });

  it('does NOT confirm an unrelated new transaction onto a pending row', () => {
    // New transaction shares only generic words with an existing pending row.
    // It must be created, not confirmed onto (and stealing) the pending's allocation.
    const existing = [
      base({ id: 'p1', status: 'pending', amount: -18, description: 'EFTPOS PURCHASE CAFE XYZ' }),
    ];
    expect(
      decideSyncAction(
        { externalId: 'new1', hash: 'hN', date: new Date('2026-05-03'), amount: -20, description: 'EFTPOS PURCHASE BP CONNECT' },
        existing
      )
    ).toEqual({ type: 'create' });
  });
});

describe('matchPendingRow', () => {
  const pending = (over: Partial<PendingCandidate>): PendingCandidate => ({
    id: 'p',
    accountId: 'acc1',
    date: new Date('2026-06-07'),
    amount: -12,
    description: 'Pasta Paradiso Card number: 4835 **** **** 0599',
    ...over,
  });

  it('updates the same pending re-reported across syncs (same account/amount/desc)', () => {
    const local = [pending({ id: 'p1' })];
    expect(
      matchPendingRow(
        { accountId: 'acc1', date: new Date('2026-06-07'), amount: -12, description: 'Pasta Paradiso Card number: 4835 **** **** 0599' },
        local,
        new Set()
      )
    ).toBe('p1');
  });

  it('does NOT merge a new transaction onto an old pending within the 30% amount band (the cross-wire bug)', () => {
    // $12 Pasta pending 2 days ago; new $16.99 "Apple.Com/Bi" pending today.
    // |12 - 16.99| = 4.99 < 30% of 16.99, so the old loose matcher merged them,
    // stealing the Pasta row's name and $12 allocation. Must NOT match now.
    const local = [pending({ id: 'p1' })];
    expect(
      matchPendingRow(
        { accountId: 'acc1', date: new Date('2026-06-09'), amount: -16.99, description: 'Apple.Com/Bi' },
        local,
        new Set()
      )
    ).toBeNull();
  });

  it('does NOT merge two same-amount pendings from different merchants (desc guard)', () => {
    const local = [pending({ id: 'p1', amount: -20, description: 'New World Metro' })];
    expect(
      matchPendingRow(
        { accountId: 'acc1', date: new Date('2026-06-07'), amount: -20, description: 'Z Energy Ponsonby' },
        local,
        new Set()
      )
    ).toBeNull();
  });

  it('does not reuse a row already consumed earlier in the same sync', () => {
    const local = [pending({ id: 'p1' })];
    expect(
      matchPendingRow(
        { accountId: 'acc1', date: new Date('2026-06-07'), amount: -12, description: 'Pasta Paradiso Card number: 4835 **** **** 0599' },
        local,
        new Set(['p1'])
      )
    ).toBeNull();
  });

  it('does not match across accounts', () => {
    const local = [pending({ id: 'p1', accountId: 'acc1' })];
    expect(
      matchPendingRow(
        { accountId: 'acc2', date: new Date('2026-06-07'), amount: -12, description: 'Pasta Paradiso Card number: 4835 **** **** 0599' },
        local,
        new Set()
      )
    ).toBeNull();
  });
});

describe('firstConnectCutoff', () => {
  it('floors to the start of the boundary day in UTC, ignoring the connect time-of-day', () => {
    // Real incident: connected 2026-06-08 11:45:53Z with a 2-day window.
    const cutoff = firstConnectCutoff(new Date('2026-06-08T11:45:53.767Z'), 2);
    expect(cutoff.toISOString()).toBe('2026-06-06T00:00:00.000Z');
  });

  it('includes a transaction from the morning of the boundary day (the stuck-pending bug)', () => {
    // Grey Roasting at 06-06 01:35Z was dropped when the cutoff kept the connect
    // time (06-06 11:45Z). Against a day-floored cutoff it must NOT be excluded.
    const cutoff = firstConnectCutoff(new Date('2026-06-08T11:45:53.767Z'), 2);
    expect(new Date('2026-06-06T01:35:36.000Z') < cutoff).toBe(false);
  });

  it('still excludes anything before the boundary day', () => {
    const cutoff = firstConnectCutoff(new Date('2026-06-08T11:45:53.767Z'), 2);
    expect(new Date('2026-06-05T23:59:59.000Z') < cutoff).toBe(true);
  });
});

describe('decideDisappearedPending', () => {
  it('deletes an allocation-free disappeared pending regardless of age', () => {
    expect(decideDisappearedPending({ hasAllocations: false, ageDays: 0 })).toBe('delete');
    expect(decideDisappearedPending({ hasAllocations: false, ageDays: 99 })).toBe('delete');
  });

  it('keeps a recently-disappeared allocated pending (likely a transient feed gap)', () => {
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: 1 })).toBe('keep');
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: STALE_PENDING_DAYS - 0.5 })).toBe('keep');
  });

  it('promotes an allocated pending that has been gone past the stale threshold', () => {
    // The user's stuck rows: allocated, ~8 days pending, no confirmed counterpart.
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: 8 })).toBe('promote');
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: STALE_PENDING_DAYS })).toBe('promote');
  });

  it('respects a custom stale threshold', () => {
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: 3, stalePendingDays: 7 })).toBe('keep');
    expect(decideDisappearedPending({ hasAllocations: true, ageDays: 7, stalePendingDays: 7 })).toBe('promote');
  });
});

describe('confirmedFieldsDiffer', () => {
  const fields = (over: Partial<ConfirmedFields> = {}): ConfirmedFields => ({
    externalId: 'trans_1',
    hash: 'h1',
    amount: -26.5,
    merchant: 'Grey Roasting Co',
    description: 'Grey Roasting Co Card number: 4835 **** **** 0599',
    category: 'Specialty food stores',
    balanceAfter: 1559.35,
    ...over,
  });

  it('is false when an identical transaction is re-synced (no spurious update)', () => {
    expect(confirmedFieldsDiffer(fields(), fields())).toBe(false);
  });

  it('treats equal null balances as unchanged', () => {
    expect(confirmedFieldsDiffer(fields({ balanceAfter: null }), fields({ balanceAfter: null }))).toBe(false);
  });

  it('detects a changed amount', () => {
    expect(confirmedFieldsDiffer(fields(), fields({ amount: -27 }))).toBe(true);
  });

  it('detects an absorbed (reissued) externalId', () => {
    expect(confirmedFieldsDiffer(fields(), fields({ externalId: 'trans_2' }))).toBe(true);
  });

  it('detects a category appearing where there was none', () => {
    expect(confirmedFieldsDiffer(fields({ category: null }), fields({ category: 'Food' }))).toBe(true);
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
