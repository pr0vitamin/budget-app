/**
 * Sync pending transactions from Akahu
 */
import { prisma } from './db';
import { getPendingTransactions } from './akahu';

interface SyncPendingResult {
    newCount: number;
    deletedCount: number;
}

/**
 * Sync pending transactions for a user
 * - Creates new pending transactions from Akahu
 * - Deletes stale pending transactions no longer in Akahu
 */
export async function syncPendingTransactions(userId: string): Promise<SyncPendingResult> {
    // Get user's account IDs (Akahu ID -> internal ID mapping)
    const accounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true, akahuId: true },
    });

    const akahuIdToAccountId = new Map(accounts.map(a => [a.akahuId, a.id]));
    const accountIds = accounts.map(a => a.id);

    // Fetch pending from Akahu
    const akahuPending = await getPendingTransactions();

    // Filter to only this user's accounts
    const userPending = akahuPending.filter(p => akahuIdToAccountId.has(p._account));

    // Get existing pending transactions
    const existingPending = await prisma.transaction.findMany({
        where: {
            accountId: { in: accountIds },
            status: 'pending',
        },
        select: { id: true, accountId: true, date: true, description: true, amount: true },
    });

    // Build set of Akahu pending keys for comparison
    const akahuPendingKeys = new Set(
        userPending.map(p => makePendingKey(
            akahuIdToAccountId.get(p._account)!,
            new Date(p.date),
            p.description,
            p.amount
        ))
    );

    // Delete stale pending (not in Akahu anymore)
    const staleIds = existingPending
        .filter(e => !akahuPendingKeys.has(makePendingKey(
            e.accountId!,
            e.date,
            e.description || '',
            Number(e.amount)
        )))
        .map(e => e.id);

    if (staleIds.length > 0) {
        await prisma.transaction.deleteMany({
            where: { id: { in: staleIds } },
        });
    }

    // Build set of existing pending keys
    const existingKeys = new Set(
        existingPending.map(e => makePendingKey(
            e.accountId!,
            e.date,
            e.description || '',
            Number(e.amount)
        ))
    );

    // Create new pending transactions
    let newCount = 0;
    for (const pending of userPending) {
        const accountId = akahuIdToAccountId.get(pending._account)!;
        const key = makePendingKey(accountId, new Date(pending.date), pending.description, pending.amount);

        if (!existingKeys.has(key)) {
            await prisma.transaction.create({
                data: {
                    accountId,
                    externalId: null,
                    amount: pending.amount,
                    date: new Date(pending.date),
                    description: pending.description,
                    merchant: extractMerchant(pending.description),
                    status: 'pending',
                    isManual: false,
                    transactionType: pending.type.toLowerCase(),
                },
            });
            newCount++;
        }
    }

    return { newCount, deletedCount: staleIds.length };
}

/**
 * Create a unique key for pending transaction matching
 */
function makePendingKey(accountId: string, date: Date, description: string, amount: number): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${accountId}:${dateStr}:${description}:${amount.toFixed(2)}`;
}

/**
 * Extract merchant name from description
 */
function extractMerchant(description: string): string {
    return description.replace(/\s+/g, ' ').trim().slice(0, 100);
}
