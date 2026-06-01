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

  it('matches when a pending amount settles within tolerance', () => {
    // pending $1.00 pre-auth settles to $1.05, same day/desc
    expect(
      transactionsMatch(
        { date: new Date('2026-05-01'), amount: -1, description: 'Cafe Hold' },
        { date: new Date('2026-05-01'), amount: -1.05, description: 'Cafe Hold' }
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
});
