/**
 * Utilities for scheduled transactions
 */

/**
 * Calculate the next due date based on frequency
 */
export function calculateNextDue(
    startDate: Date,
    frequency: string,
    interval: number = 1
): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    // If start date is in the future, that's the next due date
    if (current > now) {
        return current;
    }

    // Calculate next occurrence based on frequency
    while (current <= now) {
        switch (frequency) {
            case 'weekly':
                current.setDate(current.getDate() + 7 * interval);
                break;
            case 'fortnightly':
                current.setDate(current.getDate() + 14 * interval);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + interval);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + interval);
                break;
            case 'custom':
                // Custom uses interval as days
                current.setDate(current.getDate() + interval);
                break;
            default:
                // Default to monthly
                current.setMonth(current.getMonth() + 1);
        }
    }

    return current;
}

/**
 * Advance to the next due date after the current one
 */
export function advanceToNextDue(
    currentDue: Date,
    frequency: string,
    interval: number = 1
): Date {
    const next = new Date(currentDue);

    switch (frequency) {
        case 'weekly':
            next.setDate(next.getDate() + 7 * interval);
            break;
        case 'fortnightly':
            next.setDate(next.getDate() + 14 * interval);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + interval);
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + interval);
            break;
        case 'custom':
            next.setDate(next.getDate() + interval);
            break;
        default:
            next.setMonth(next.getMonth() + 1);
    }

    return next;
}

/**
 * Check if a transaction matches a scheduled transaction
 * Based on amount tolerance (±20%) and date tolerance (±5 days)
 */
export function matchesScheduled(
    transaction: { amount: number; date: Date },
    scheduled: { amount: number; nextDue: Date }
): { matches: boolean; amountDiff: number; daysDiff: number } {
    const amountDiff = Math.abs(Math.abs(transaction.amount) - Math.abs(scheduled.amount));
    const amountTolerance = Math.abs(scheduled.amount) * 0.2; // 20%

    const txDate = new Date(transaction.date);
    txDate.setHours(0, 0, 0, 0);
    const dueDate = new Date(scheduled.nextDue);
    dueDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.abs((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const dateTolerance = 5; // ±5 days

    const matches = amountDiff <= amountTolerance && daysDiff <= dateTolerance;

    return { matches, amountDiff, daysDiff };
}
