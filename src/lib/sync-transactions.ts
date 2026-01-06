import { prisma } from '@/lib/db';
import { getTransactions, AkahuTransaction } from '@/lib/akahu';
import { applyCategorizationRules } from '@/lib/auto-categorize';

interface SyncResult {
    newCount: number;
    updatedCount: number;
    amendedCount: number;
}

/**
 * Sync transactions from Akahu for a specific account
 */
export async function syncAccountTransactions(
    accountId: string,
    userId: string
): Promise<SyncResult> {
    // Get the account to find Akahu ID
    const account = await prisma.account.findUnique({
        where: { id: accountId },
    });

    if (!account) {
        throw new Error('Account not found');
    }

    if (account.userId !== userId) {
        throw new Error('Unauthorized');
    }

    // Determine date range - last 90 days or since last sync
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const startDate = account.lastSyncAt && account.lastSyncAt > ninetyDaysAgo
        ? account.lastSyncAt
        : ninetyDaysAgo;

    // Fetch transactions from Akahu
    const akahuTransactions = await getTransactions(
        account.akahuId,
        startDate.toISOString().split('T')[0]
    );

    let newCount = 0;
    let updatedCount = 0;
    let amendedCount = 0;

    // Process each transaction
    for (const akahuTx of akahuTransactions) {
        const existingTx = await prisma.transaction.findFirst({
            where: { externalId: akahuTx._id },
            include: { allocations: true },
        });

        if (existingTx) {
            // Check for amendments
            const isAmended = detectAmendment(existingTx, akahuTx);

            if (isAmended) {
                await handleAmendedTransaction(existingTx, akahuTx);
                amendedCount++;
                updatedCount++;
            } else {
                // Update non-critical fields
                await prisma.transaction.update({
                    where: { id: existingTx.id },
                    data: {
                        balance: akahuTx.balance ?? null,
                    },
                });
                updatedCount++;
            }
        } else {
            // Create new transaction
            const newTx = await prisma.transaction.create({
                data: {
                    accountId: accountId,
                    externalId: akahuTx._id,
                    amount: akahuTx.amount,
                    date: new Date(akahuTx.date),
                    merchant: akahuTx.merchant?.name || extractMerchant(akahuTx.description),
                    description: akahuTx.description,
                    category: akahuTx.category?.name || null,
                    balance: akahuTx.balance ?? null,
                    transactionType: akahuTx.type.toLowerCase(),
                    isManual: false,
                },
            });

            // Apply auto-categorization rules
            await applyCategorizationRules(newTx.id, userId);

            newCount++;
        }
    }

    // Update last sync timestamp
    await prisma.account.update({
        where: { id: accountId },
        data: {
            lastSyncAt: new Date(),
            connectionError: null, // Clear any previous errors
        },
    });

    return { newCount, updatedCount, amendedCount };
}

/**
 * Extract merchant name from description if not provided
 */
function extractMerchant(description: string): string {
    // Simple extraction - take first part before common separators
    const parts = description.split(/[-–—\s{2,}]/);
    return parts[0]?.trim() || description.slice(0, 50);
}

/**
 * Detect if a transaction has been amended
 */
function detectAmendment(
    existing: { amount: { toNumber: () => number }; merchant: string | null },
    akahu: AkahuTransaction
): boolean {
    const existingAmount = existing.amount.toNumber();
    const akahuAmount = akahu.amount;
    const akahuMerchant = akahu.merchant?.name || null;

    // Amount changed
    if (Math.abs(existingAmount - akahuAmount) > 0.01) {
        return true;
    }

    // Merchant changed significantly (and we have a merchant name)
    if (akahuMerchant && existing.merchant &&
        akahuMerchant.toLowerCase() !== existing.merchant.toLowerCase()) {
        return true;
    }

    return false;
}

/**
 * Handle an amended transaction according to spec:
 * - Single allocation: keep allocation, flag as amended
 * - Multi-bucket split: delete allocations, add to unallocated
 */
async function handleAmendedTransaction(
    existing: { id: string; allocations: { id: string }[] },
    akahu: AkahuTransaction
): Promise<void> {
    const hasMultipleAllocations = existing.allocations.length > 1;

    if (hasMultipleAllocations) {
        // Delete all allocations for split transactions
        await prisma.allocation.deleteMany({
            where: { transactionId: existing.id },
        });
    }

    // Update transaction with new values and flag as amended
    await prisma.transaction.update({
        where: { id: existing.id },
        data: {
            amount: akahu.amount,
            merchant: akahu.merchant?.name || extractMerchant(akahu.description),
            description: akahu.description,
            isAmended: true,
            // If split was removed, transaction goes back to unallocated state
        },
    });
}
