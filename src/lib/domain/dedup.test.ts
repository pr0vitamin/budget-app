import { describe, it, expect } from 'vitest';
import { accountIdentityKey, fallbackDedupKey, transactionsMatch } from './dedup';

describe('accountIdentityKey', () => {
  it('prefers the stable account number when present', () => {
    expect(accountIdentityKey({ akahuId: 'acc_new', accountNumber: '12-1234-1234567-00' })).toBe(
      'num:12-1234-1234567-00'
    );
  });

  it('falls back to the akahu id when there is no account number', () => {
    expect(accountIdentityKey({ akahuId: 'acc_x', accountNumber: null })).toBe('akahu:acc_x');
  });
});

describe('fallbackDedupKey', () => {
  it('builds a stable key from account, date, amount and description', () => {
    const key = fallbackDedupKey({
      accountId: 'a1',
      date: new Date('2026-05-01T10:00:00Z'),
      amount: -12.9,
      description: 'Countdown',
    });
    expect(key).toBe('a1:2026-05-01:-12.90:countdown');
  });
});

describe('transactionsMatch', () => {
  const base = { date: new Date('2026-05-01'), amount: -12.9, description: 'Countdown Ponsonby' };

  it('matches an identical incoming transaction', () => {
    expect(transactionsMatch(base, { ...base })).toBe(true);
  });

  it('does NOT match when the amount differs at all (no pre-auth tolerance)', () => {
    // Same day/desc but $1.00 vs $1.05 — an amount difference always means a
    // different transaction; only an exact amount (within float noise) matches.
    expect(
      transactionsMatch(
        { date: new Date('2026-05-01'), amount: -1, description: 'Cafe Hold' },
        { date: new Date('2026-05-01'), amount: -1.05, description: 'Cafe Hold' }
      )
    ).toBe(false);
  });

  it('matches an exact amount despite float representation noise', () => {
    expect(
      transactionsMatch(
        { date: new Date('2026-05-01'), amount: -0.1 - 0.2, description: 'Cafe' },
        { date: new Date('2026-05-01'), amount: -0.3, description: 'Cafe' }
      )
    ).toBe(true);
  });

  it('does not match different merchants on the same day/amount', () => {
    expect(
      transactionsMatch(base, { date: new Date('2026-05-01'), amount: -12.9, description: 'BP Fuel' })
    ).toBe(false);
  });

  it('does not match when dates are more than 5 days apart', () => {
    expect(
      transactionsMatch(base, { ...base, date: new Date('2026-05-10') })
    ).toBe(false);
  });

  it('does NOT match unrelated transactions that only share generic words', () => {
    // Different merchants, within 5 days and 30% amount, sharing only generic
    // banking tokens (EFTPOS, PURCHASE). These must NOT be treated as the same
    // transaction — this is the bug that cross-wired allocations on sync.
    expect(
      transactionsMatch(
        { date: new Date('2026-05-03'), amount: -20, description: 'EFTPOS PURCHASE BP CONNECT' },
        { date: new Date('2026-05-01'), amount: -18, description: 'EFTPOS PURCHASE CAFE XYZ' }
      )
    ).toBe(false);
  });

  it('still matches a raw pending description against its enriched confirmed merchant', () => {
    // The enriched merchant is a substring of the raw pending description.
    expect(
      transactionsMatch(
        { date: new Date('2026-05-01'), amount: -42.5, description: 'POS W/D COUNTDOWN PONSONBY 1234' },
        { date: new Date('2026-05-01'), amount: -42.5, description: 'Countdown Ponsonby' }
      )
    ).toBe(true);
  });
});
