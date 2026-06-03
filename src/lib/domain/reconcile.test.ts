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
