import { describe, it, expect } from 'vitest';
import {
    calculateBucketBalance,
    calculateBucketBalances,
    getPeriodStartDate,
    getPeriodEndDate,
    calculateRolloverAmount,
    type BudgetCycleConfig,
} from './budget-utils';

describe('calculateBucketBalance', () => {
    it('returns 0 for bucket with no allocations', () => {
        const bucket = { id: '1', name: 'Test', allocations: [] };
        expect(calculateBucketBalance(bucket)).toBe(0);
    });

    it('calculates positive balance from inflows', () => {
        const bucket = {
            id: '1',
            name: 'Test',
            allocations: [{ amount: 100 }, { amount: 50 }],
        };
        expect(calculateBucketBalance(bucket)).toBe(150);
    });

    it('calculates negative balance from outflows', () => {
        const bucket = {
            id: '1',
            name: 'Test',
            allocations: [{ amount: 100 }, { amount: -150 }],
        };
        expect(calculateBucketBalance(bucket)).toBe(-50);
    });

    it('handles mixed inflows and outflows', () => {
        const bucket = {
            id: '1',
            name: 'Groceries',
            allocations: [
                { amount: 500 },   // Budget allocation
                { amount: -75.50 }, // Grocery shop
                { amount: -42.30 }, // Another shop
                { amount: -18.20 }, // Small purchase
            ],
        };
        expect(calculateBucketBalance(bucket)).toBeCloseTo(364, 2);
    });
});

describe('calculateBucketBalances', () => {
    it('returns empty map for empty array', () => {
        const result = calculateBucketBalances([]);
        expect(result.size).toBe(0);
    });

    it('calculates balances for multiple buckets', () => {
        const buckets = [
            { id: '1', name: 'Groceries', allocations: [{ amount: 100 }] },
            { id: '2', name: 'Transport', allocations: [{ amount: 50 }] },
        ];
        const result = calculateBucketBalances(buckets);
        expect(result.get('1')).toBe(100);
        expect(result.get('2')).toBe(50);
    });
});

describe('getPeriodStartDate', () => {
    describe('weekly cycle', () => {
        it('returns current week start on the start day', () => {
            const config: BudgetCycleConfig = { type: 'weekly', startDay: 4 }; // Thursday
            // Jan 9, 2025 is a Thursday
            const ref = new Date('2025-01-09T12:00:00');
            const start = getPeriodStartDate(config, ref);
            expect(start.getDay()).toBe(4); // Thursday
            expect(start.getDate()).toBe(9);
        });

        it('returns previous week start when past start day', () => {
            const config: BudgetCycleConfig = { type: 'weekly', startDay: 4 }; // Thursday
            // Jan 11, 2025 is a Saturday
            const ref = new Date('2025-01-11T12:00:00');
            const start = getPeriodStartDate(config, ref);
            expect(start.getDay()).toBe(4); // Thursday
            expect(start.getDate()).toBe(9); // Previous Thursday
        });
    });

    describe('monthly cycle', () => {
        it('returns current month start when past start day', () => {
            const config: BudgetCycleConfig = { type: 'monthly', startDay: 15 };
            const ref = new Date('2025-01-20T12:00:00');
            const start = getPeriodStartDate(config, ref);
            expect(start.getDate()).toBe(15);
            expect(start.getMonth()).toBe(0); // January
        });

        it('returns previous month start when before start day', () => {
            const config: BudgetCycleConfig = { type: 'monthly', startDay: 15 };
            const ref = new Date('2025-01-10T12:00:00');
            const start = getPeriodStartDate(config, ref);
            expect(start.getDate()).toBe(15);
            expect(start.getMonth()).toBe(11); // December (previous year)
        });
    });
});

describe('getPeriodEndDate', () => {
    it('returns 6 days after start for weekly', () => {
        const config: BudgetCycleConfig = { type: 'weekly', startDay: 4 };
        const ref = new Date('2025-01-09T12:00:00'); // Thursday
        const end = getPeriodEndDate(config, ref);
        expect(end.getDate()).toBe(15); // Wednesday next week
    });

    it('returns 13 days after start for fortnightly', () => {
        const config: BudgetCycleConfig = { type: 'fortnightly', startDay: 4 };
        const ref = new Date('2025-01-09T12:00:00');
        const start = getPeriodStartDate(config, ref);
        const end = getPeriodEndDate(config, ref);
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(13); // 14 days - 1
    });
});

describe('calculateRolloverAmount', () => {
    it('returns 0 when rollover disabled', () => {
        expect(calculateRolloverAmount(100, false, 'spending')).toBe(0);
        expect(calculateRolloverAmount(100, false, 'savings')).toBe(0);
    });

    it('returns full balance for savings buckets', () => {
        expect(calculateRolloverAmount(500, true, 'savings')).toBe(500);
        expect(calculateRolloverAmount(-50, true, 'savings')).toBe(-50);
    });

    it('returns balance for spending buckets with rollover', () => {
        expect(calculateRolloverAmount(100, true, 'spending')).toBe(100);
        expect(calculateRolloverAmount(-50, true, 'spending')).toBe(-50); // Debt carries forward
    });
});
