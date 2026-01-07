import { describe, it, expect } from 'vitest';
import { calculateNextDue, advanceToNextDue, matchesScheduled } from './scheduled-utils';

describe('Scheduled Transaction Utils', () => {
    describe('calculateNextDue', () => {
        it('returns start date if in the future', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10);

            const result = calculateNextDue(futureDate, 'weekly');

            expect(result.getDate()).toBe(futureDate.getDate());
        });

        it('calculates weekly correctly', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 3); // 3 days ago

            const result = calculateNextDue(pastDate, 'weekly');
            const expected = new Date(pastDate);
            expected.setDate(expected.getDate() + 7);

            expect(result.getDate()).toBe(expected.getDate());
        });

        it('calculates fortnightly correctly', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

            const result = calculateNextDue(pastDate, 'fortnightly');
            const expected = new Date(pastDate);
            expected.setDate(expected.getDate() + 14);

            expect(result.getDate()).toBe(expected.getDate());
        });

        it('calculates monthly correctly', () => {
            const pastDate = new Date();
            pastDate.setDate(1);
            pastDate.setMonth(pastDate.getMonth() - 1); // Last month

            const result = calculateNextDue(pastDate, 'monthly');

            // Should be this month or next
            const now = new Date();
            expect(result >= now).toBe(true);
        });

        it('calculates yearly correctly', () => {
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 1);
            pastDate.setMonth(pastDate.getMonth() + 1); // Next month of last year

            const result = calculateNextDue(pastDate, 'yearly');

            // Should be this year or next
            const now = new Date();
            expect(result >= now).toBe(true);
        });

        it('handles custom interval', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

            const result = calculateNextDue(pastDate, 'custom', 10); // Every 10 days

            const now = new Date();
            expect(result >= now).toBe(true);
        });
    });

    describe('advanceToNextDue', () => {
        it('advances weekly by 7 days', () => {
            const currentDue = new Date('2024-01-15');
            const next = advanceToNextDue(currentDue, 'weekly');

            expect(next.toISOString().split('T')[0]).toBe('2024-01-22');
        });

        it('advances fortnightly by 14 days', () => {
            const currentDue = new Date('2024-01-15');
            const next = advanceToNextDue(currentDue, 'fortnightly');

            expect(next.toISOString().split('T')[0]).toBe('2024-01-29');
        });

        it('advances monthly by 1 month', () => {
            const currentDue = new Date('2024-01-15');
            const next = advanceToNextDue(currentDue, 'monthly');

            expect(next.getMonth()).toBe(1); // February
        });

        it('advances yearly by 1 year', () => {
            const currentDue = new Date('2024-01-15');
            const next = advanceToNextDue(currentDue, 'yearly');

            expect(next.getFullYear()).toBe(2025);
        });

        it('advances custom by interval days', () => {
            const currentDue = new Date('2024-01-15');
            const next = advanceToNextDue(currentDue, 'custom', 5);

            expect(next.toISOString().split('T')[0]).toBe('2024-01-20');
        });
    });

    describe('matchesScheduled', () => {
        it('matches when amount and date are within tolerance', () => {
            const transaction = { amount: -50, date: new Date('2024-01-15') };
            const scheduled = { amount: -52, nextDue: new Date('2024-01-16') };

            const result = matchesScheduled(transaction, scheduled);

            expect(result.matches).toBe(true);
        });

        it('does not match when amount exceeds 20% tolerance', () => {
            const transaction = { amount: -50, date: new Date('2024-01-15') };
            const scheduled = { amount: -65, nextDue: new Date('2024-01-15') }; // 30% difference

            const result = matchesScheduled(transaction, scheduled);

            expect(result.matches).toBe(false);
        });

        it('does not match when date exceeds 5 day tolerance', () => {
            const transaction = { amount: -50, date: new Date('2024-01-22') };
            const scheduled = { amount: -50, nextDue: new Date('2024-01-15') }; // 7 days difference

            const result = matchesScheduled(transaction, scheduled);

            expect(result.matches).toBe(false);
        });

        it('returns diffs even when matching', () => {
            const transaction = { amount: -50, date: new Date('2024-01-16') };
            const scheduled = { amount: -52, nextDue: new Date('2024-01-15') };

            const result = matchesScheduled(transaction, scheduled);

            expect(result.amountDiff).toBe(2);
            expect(result.daysDiff).toBe(1);
        });
    });
});
