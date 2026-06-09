import { describe, it, expect } from 'vitest';
import {
  decideSyncAction,
  matchPendingRow,
  reconcileAllocations,
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
