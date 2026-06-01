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
