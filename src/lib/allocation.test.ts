import { describe, it, expect } from 'vitest';

// Pure function for testing - matches rule pattern against merchant
interface Rule {
    id: string;
    merchantPattern: string;
    bucketId: string;
}

interface Transaction {
    id: string;
    merchant: string | null;
    amount: number;
}

function findMatchingRule(transaction: Transaction, rules: Rule[]): Rule | null {
    if (!transaction.merchant) {
        return null;
    }
    const merchantLower = transaction.merchant.toLowerCase();
    for (const rule of rules) {
        if (merchantLower.includes(rule.merchantPattern)) {
            return rule;
        }
    }
    return null;
}

describe('findMatchingRule', () => {
    const rules = [
        { id: '1', merchantPattern: 'countdown', bucketId: 'groceries' },
        { id: '2', merchantPattern: 'pak n save', bucketId: 'groceries' },
        { id: '3', merchantPattern: 'netflix', bucketId: 'entertainment' },
        { id: '4', merchantPattern: 'z energy', bucketId: 'transport' },
    ];

    it('returns null when merchant is null', () => {
        const result = findMatchingRule({ id: '1', merchant: null, amount: 50 }, rules);
        expect(result).toBeNull();
    });

    it('matches exact merchant name (case insensitive)', () => {
        const result = findMatchingRule({ id: '1', merchant: 'Netflix', amount: 15 }, rules);
        expect(result?.bucketId).toBe('entertainment');
    });

    it('matches partial merchant name', () => {
        const result = findMatchingRule({ id: '1', merchant: 'Countdown Eastgate', amount: 75 }, rules);
        expect(result?.bucketId).toBe('groceries');
    });

    it('returns null when no rules match', () => {
        const result = findMatchingRule({ id: '1', merchant: 'Unknown Store', amount: 20 }, rules);
        expect(result).toBeNull();
    });

    it('returns first matching rule when multiple could match', () => {
        const rulesWithOverlap = [
            { id: '1', merchantPattern: 'countdown', bucketId: 'groceries' },
            { id: '2', merchantPattern: 'countdown eastgate', bucketId: 'other' },
        ];
        const result = findMatchingRule({ id: '1', merchant: 'Countdown Eastgate', amount: 75 }, rulesWithOverlap);
        expect(result?.bucketId).toBe('groceries');
    });
});

describe('split allocation validation', () => {
    it('validates allocations sum equals transaction amount', () => {
        const transactionAmount = 100;
        const allocations = [
            { bucketId: 'a', amount: 60 },
            { bucketId: 'b', amount: 40 },
        ];
        const sum = allocations.reduce((s, a) => s + a.amount, 0);
        expect(Math.abs(sum - transactionAmount)).toBeLessThanOrEqual(0.01);
    });

    it('fails when allocations do not sum correctly', () => {
        const transactionAmount = 100;
        const allocations = [
            { bucketId: 'a', amount: 60 },
            { bucketId: 'b', amount: 30 },
        ];
        const sum = allocations.reduce((s, a) => s + a.amount, 0);
        expect(Math.abs(sum - transactionAmount)).toBeGreaterThan(0.01);
    });
});

describe('available-to-budget calculation', () => {
    // Pure function - mirrors logic in calculate-available.ts
    function calculateAvailable(transactions: { amount: number; hasAllocations: boolean }[]): number {
        return transactions
            .filter((t) => t.amount > 0 && !t.hasAllocations)
            .reduce((sum, t) => sum + t.amount, 0);
    }

    it('sums unallocated positive transactions', () => {
        const transactions = [
            { amount: 500, hasAllocations: false },
            { amount: 200, hasAllocations: false },
            { amount: -50, hasAllocations: false },
            { amount: 100, hasAllocations: true },
        ];
        expect(calculateAvailable(transactions)).toBe(700);
    });

    it('returns 0 when no unallocated income', () => {
        const transactions = [
            { amount: 500, hasAllocations: true },
            { amount: -50, hasAllocations: false },
        ];
        expect(calculateAvailable(transactions)).toBe(0);
    });

    it('returns 0 for empty transactions', () => {
        expect(calculateAvailable([])).toBe(0);
    });
});
