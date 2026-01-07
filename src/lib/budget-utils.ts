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
    startDate: Date; // A known start date of a budget cycle
}

/**
 * Get the start date of the current budget period.
 * Works by finding which cycle period the reference date falls into.
 */
export function getPeriodStartDate(config: BudgetCycleConfig, referenceDate: Date = new Date()): Date {
    const { type, startDate } = config;
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    // Get interval in days based on type
    const intervalDays = type === 'weekly' ? 7 : type === 'fortnightly' ? 14 : 0;

    if (type === 'monthly') {
        // For monthly, find the most recent occurrence of start day-of-month
        const startDayOfMonth = start.getDate();
        const result = new Date(ref);
        result.setDate(startDayOfMonth);

        if (result > ref) {
            // Go back one month
            result.setMonth(result.getMonth() - 1);
            result.setDate(startDayOfMonth); // Reset in case month wrap changed it
        }

        return result;
    } else {
        // For weekly/fortnightly, calculate how many full periods since start
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysSinceStart = Math.floor((ref.getTime() - start.getTime()) / msPerDay);

        if (daysSinceStart < 0) {
            // Reference is before start date, return start date
            return new Date(start);
        }

        const periodsElapsed = Math.floor(daysSinceStart / intervalDays);
        const result = new Date(start);
        result.setDate(result.getDate() + (periodsElapsed * intervalDays));

        return result;
    }
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
