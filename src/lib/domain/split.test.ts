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
