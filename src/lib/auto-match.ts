/**
 * Auto-match incoming transactions to scheduled transactions
 */
import { prisma } from './db';
import { matchesScheduled, advanceToNextDue } from './scheduled-utils';

/**
 * Find and auto-match a transaction to scheduled transactions
 * If matched: allocates to bucket, advances nextDue, links transaction
 * Returns the matched scheduled transaction ID if found, null otherwise
 */
export async function autoMatchToScheduled(
    transaction: { id: string; amount: number; date: Date },
    userId: string
): Promise<string | null> {
    // Get all enabled scheduled transactions for this user
    const scheduledList = await prisma.scheduledTransaction.findMany({
        where: { userId, enabled: true },
        orderBy: { nextDue: 'asc' },
    });

    // Find the best match (prefer closer dates)
    let bestMatch: {
        scheduled: (typeof scheduledList)[0];
        daysDiff: number;
    } | null = null;

    for (const scheduled of scheduledList) {
        const result = matchesScheduled(transaction, {
            amount: Number(scheduled.amount),
            nextDue: scheduled.nextDue,
        });

        if (result.matches) {
            if (!bestMatch || result.daysDiff < bestMatch.daysDiff) {
                bestMatch = { scheduled, daysDiff: result.daysDiff };
            }
        }
    }

    if (!bestMatch) {
        return null;
    }

    const scheduled = bestMatch.scheduled;

    // Create allocation to the scheduled transaction's bucket
    await prisma.allocation.create({
        data: {
            transactionId: transaction.id,
            bucketId: scheduled.bucketId,
            amount: transaction.amount,
        },
    });

    // Link transaction to scheduled and advance nextDue
    const newNextDue = advanceToNextDue(scheduled.nextDue, scheduled.frequency, scheduled.interval);

    await prisma.scheduledTransaction.update({
        where: { id: scheduled.id },
        data: { nextDue: newNextDue },
    });

    // Update transaction to link to scheduled
    await prisma.transaction.update({
        where: { id: transaction.id },
        data: { matchedScheduleId: scheduled.id },
    });

    return scheduled.id;
}
