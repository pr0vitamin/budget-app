import { Prisma } from '@prisma/client';

/**
 * Core budget calculation utilities
 * These are pure functions that can be easily unit tested
 */

export interface AllocationData {
    amount: number | Prisma.Decimal;
}

export interface BucketWithAllocations {
    id: string;
    name: string;
    allocations: AllocationData[];
}

/**
 * Calculate the balance of a bucket from its allocations
 * Balance = sum of all allocation amounts
 */
export function calculateBucketBalance(bucket: BucketWithAllocations): number {
    return bucket.allocations.reduce((sum, allocation) => {
        const amount =
            typeof allocation.amount === 'number'
                ? allocation.amount
                : Number(allocation.amount);
        return sum + amount;
    }, 0);
}

/**
 * Calculate balances for multiple buckets
 */
export function calculateBucketBalances(
    buckets: BucketWithAllocations[]
): Map<string, number> {
    const balances = new Map<string, number>();
    for (const bucket of buckets) {
        balances.set(bucket.id, calculateBucketBalance(bucket));
    }
    return balances;
}

/**
 * Budget cycle types
 */
export type BudgetCycleType = 'weekly' | 'fortnightly' | 'monthly';

export interface BudgetCycleConfig {
    type: BudgetCycleType;
    startDay: number; // 0-6 for weekly/fortnightly (day of week), 1-31 for monthly
}

/**
 * Get the start date of the current budget period
 */
export function getPeriodStartDate(config: BudgetCycleConfig, referenceDate: Date = new Date()): Date {
    const { type, startDay } = config;
    const date = new Date(referenceDate);
    date.setHours(0, 0, 0, 0);

    if (type === 'monthly') {
        // For monthly, start on the specified day of the month
        const currentDay = date.getDate();
        if (currentDay >= startDay) {
            // Current period started this month
            date.setDate(startDay);
        } else {
            // Current period started last month
            date.setMonth(date.getMonth() - 1);
            date.setDate(startDay);
        }
    } else {
        // For weekly/fortnightly, find the most recent occurrence of startDay
        const currentDayOfWeek = date.getDay();
        let daysBack = currentDayOfWeek - startDay;
        if (daysBack < 0) daysBack += 7;

        // For fortnightly, we need to check if we're in the first or second week
        if (type === 'fortnightly') {
            // Use a fixed reference point (Jan 1, 2024 was a Monday)
            const refPoint = new Date('2024-01-01');
            const daysSinceRef = Math.floor((date.getTime() - refPoint.getTime()) / (1000 * 60 * 60 * 24));
            const weeksSinceRef = Math.floor(daysSinceRef / 7);

            // If we're in an odd week from reference, add 7 more days back
            if (weeksSinceRef % 2 === 1) {
                daysBack += 7;
            }
        }

        date.setDate(date.getDate() - daysBack);
    }

    return date;
}

/**
 * Get the end date of the current budget period
 */
export function getPeriodEndDate(config: BudgetCycleConfig, referenceDate: Date = new Date()): Date {
    const startDate = getPeriodStartDate(config, referenceDate);
    const { type } = config;

    if (type === 'monthly') {
        // End is the day before start day next month
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        return endDate;
    } else if (type === 'fortnightly') {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 13); // 14 days - 1
        return endDate;
    } else {
        // weekly
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // 7 days - 1
        return endDate;
    }
}

/**
 * Calculate rollover amount for a bucket at period end
 * Returns the amount to carry forward (positive) or reset (0)
 */
export function calculateRolloverAmount(
    balance: number,
    rolloverEnabled: boolean,
    bucketType: 'spending' | 'savings'
): number {
    if (!rolloverEnabled) {
        return 0;
    }

    // Savings buckets always keep their full balance
    if (bucketType === 'savings') {
        return balance;
    }

    // Spending buckets with rollover enabled keep positive balance
    // Negative balances are also rolled over (debt carries forward)
    return balance;
}
