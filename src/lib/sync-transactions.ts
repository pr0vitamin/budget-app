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
    userId: string,
    initialDays: number = 30
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

    // Check if this account has any transactions (first sync detection)
    const existingTxCount = await prisma.transaction.count({
        where: { accountId },
    });
    const isFirstSync = existingTxCount === 0;

    // Determine how far back to fetch
    const MAX_DAYS = 30;
    let daysBack: number;
    if (isFirstSync) {
        // First sync: use provided initialDays (max 30)
        daysBack = Math.min(Math.max(1, initialDays), MAX_DAYS);
    } else {
        // Subsequent syncs: always fetch 30 days (deduplication handles the rest)
        daysBack = MAX_DAYS;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

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
            }
            // Skip non-amended existing transactions (no need to update balance constantly)
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

    return { newCount, updatedCount, amendedCount };
}

interface SyncAllResult {
    totalNew: number;
    totalUpdated: number;
    totalAmended: number;
    accountsSynced: number;
}

/**
 * Sync transactions from all connected Akahu accounts for a user
 * @param initialDays - How many days to fetch for first-time account syncs (default 30, max 30)
 */
export async function syncAllAccountTransactions(
    userId: string,
    initialDays: number = 30
): Promise<SyncAllResult> {
    const accounts = await prisma.account.findMany({
        where: { userId },
    });

    let totalNew = 0;
    let totalUpdated = 0;
    let totalAmended = 0;

    for (const account of accounts) {
        try {
            const result = await syncAccountTransactions(account.id, userId, initialDays);
            totalNew += result.newCount;
            totalUpdated += result.updatedCount;
            totalAmended += result.amendedCount;
        } catch (error) {
            console.error(`Failed to sync account ${account.id}:`, error);
            // Continue with other accounts
        }
    }

    return {
        totalNew,
        totalUpdated,
        totalAmended,
        accountsSynced: accounts.length,
    };
}

/**
 * Extract merchant name from description if not provided
 * Uses the full description, just cleaned up
 */
function extractMerchant(description: string): string {
    // Clean up the description - remove excessive whitespace and trim
    return description.replace(/\s+/g, ' ').trim().slice(0, 100);
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
