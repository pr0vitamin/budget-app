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
