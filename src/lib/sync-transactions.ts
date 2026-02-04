import { prisma } from '@/lib/db';
import { getTransactions, AkahuTransaction } from '@/lib/akahu';
import { applyCategorizationRules } from '@/lib/auto-categorize';
import { autoMatchToScheduled } from '@/lib/auto-match';

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
    const MAX_INITIAL_DAYS = 30;
    const DEFAULT_SYNC_DAYS = 7;
    let daysBack: number;
    if (isFirstSync) {
        // First sync: use provided initialDays (max 30)
        daysBack = Math.min(Math.max(1, initialDays), MAX_INITIAL_DAYS);
    } else {
        // Subsequent syncs: fetch last 7 days (deduplication handles the rest)
        daysBack = DEFAULT_SYNC_DAYS;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch transactions from Akahu
    const akahuTransactions = await getTransactions(
        account.akahuId,
        startDate.toISOString().split('T')[0]
    );

    if (akahuTransactions.length === 0) {
        return { newCount: 0, updatedCount: 0, amendedCount: 0 };
    }

    // PERFORMANCE: Batch fetch all existing transactions in a single query
    const akahuIds = akahuTransactions.map(t => t._id);
    const existingTransactions = await prisma.transaction.findMany({
        where: {
            externalId: { in: akahuIds },
        },
        include: { allocations: true },
    });
    const existingByExternalId = new Map(
        existingTransactions.map(t => [t.externalId, t])
    );

    // PERFORMANCE: Batch fetch pending transactions for matching
    const pendingTransactions = await prisma.transaction.findMany({
        where: {
            accountId,
            status: 'pending',
        },
        include: { allocations: true },
    });

    let newCount = 0;
    let updatedCount = 0;
    let amendedCount = 0;

    // Separate transactions into categories for batch processing
    const toCreate: Array<{
        akahuTx: AkahuTransaction;
    }> = [];
    const toAmend: Array<{
        existing: typeof existingTransactions[0];
        akahuTx: AkahuTransaction;
    }> = [];
    const toConfirmPending: Array<{
        pending: typeof pendingTransactions[0];
        akahuTx: AkahuTransaction;
    }> = [];

    // Categorize each Akahu transaction
    for (const akahuTx of akahuTransactions) {
        const existingTx = existingByExternalId.get(akahuTx._id);

        if (existingTx) {
            // Check for amendments
            if (detectAmendment(existingTx, akahuTx)) {
                toAmend.push({ existing: existingTx, akahuTx });
            }
            // Skip non-amended existing transactions
        } else {
            // Try to match to a pending transaction
            const matchedPending = findMatchingPendingFromList(pendingTransactions, akahuTx);

            if (matchedPending) {
                toConfirmPending.push({ pending: matchedPending, akahuTx });
                // Remove from list to prevent double-matching
                const idx = pendingTransactions.indexOf(matchedPending);
                if (idx > -1) pendingTransactions.splice(idx, 1);
            } else {
                toCreate.push({ akahuTx });
            }
        }
    }

    // BATCH: Handle amendments
    for (const { existing, akahuTx } of toAmend) {
        await handleAmendedTransaction(existing, akahuTx);
        amendedCount++;
        updatedCount++;
    }

    // BATCH: Confirm pending transactions
    for (const { pending, akahuTx } of toConfirmPending) {
        await confirmPendingTransaction(pending, akahuTx);
        updatedCount++;
    }

    // BATCH: Create new transactions using createMany for performance
    if (toCreate.length > 0) {
        const createData = toCreate.map(({ akahuTx }) => ({
            accountId: accountId,
            externalId: akahuTx._id,
            amount: akahuTx.amount,
            date: new Date(akahuTx.date),
            merchant: akahuTx.merchant?.name || extractMerchant(akahuTx.description),
            description: akahuTx.description,
            category: akahuTx.category?.name || null,
            balance: akahuTx.balance ?? null,
            transactionType: akahuTx.type.toLowerCase(),
            status: 'confirmed',
            isManual: false,
        }));

        await prisma.transaction.createMany({ data: createData });
        newCount = toCreate.length;

        // Fetch the newly created transactions to get their IDs for auto-matching/categorization
        const newTransactions = await prisma.transaction.findMany({
            where: {
                externalId: { in: toCreate.map(t => t.akahuTx._id) },
            },
            select: { id: true, externalId: true, amount: true, date: true },
        });

        // Create a map from externalId to new transaction for matching
        const newTxByExternalId = new Map(
            newTransactions.map(t => [t.externalId, t])
        );

        // PARALLEL: Run auto-matching and auto-categorization concurrently
        const autoProcessing = toCreate.map(async ({ akahuTx }) => {
            const newTx = newTxByExternalId.get(akahuTx._id);
            if (!newTx) return;

            // Try to auto-match to scheduled transactions
            const matched = await autoMatchToScheduled(
                { id: newTx.id, amount: Number(newTx.amount), date: newTx.date },
                userId
            );

            // If not matched, apply auto-categorization rules
            if (!matched) {
                await applyCategorizationRules(newTx.id, userId);
            }
        });

        await Promise.all(autoProcessing);
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

/**
 * Find a matching pending transaction from an in-memory list
 * Used for batched sync to avoid N+1 database queries
 * Matching criteria: ±5 days, ±30% amount, similar description
 */
function findMatchingPendingFromList<T extends {
    id: string;
    date: Date;
    description: string | null;
    amount: { toNumber?: () => number } | number;
    allocations: { id: string; amount: { toNumber(): number } }[];
}>(
    pendingList: T[],
    akahuTx: AkahuTransaction
): T | null {
    const txDate = new Date(akahuTx.date);
    const fiveDaysAgo = new Date(txDate);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAhead = new Date(txDate);
    fiveDaysAhead.setDate(fiveDaysAhead.getDate() + 5);

    for (const pending of pendingList) {
        // Check date range
        if (pending.date < fiveDaysAgo || pending.date > fiveDaysAhead) continue;

        // Handle both Decimal and number amounts
        const pendingAmount = typeof pending.amount === 'number'
            ? pending.amount
            : pending.amount.toNumber?.() ?? Number(pending.amount);
        const akahuAmount = akahuTx.amount;

        // Amount within ±30%
        const amountDiff = Math.abs(pendingAmount - akahuAmount);
        const tolerance = Math.abs(pendingAmount) * 0.3;
        if (amountDiff > tolerance) continue;

        // Description should contain some common substring (case-insensitive)
        const pendingDesc = (pending.description || '').toLowerCase();
        const akahuDesc = akahuTx.description.toLowerCase();
        if (!descriptionsSimilar(pendingDesc, akahuDesc)) continue;

        return pending;
    }

    return null;
}

/**
 * Find a pending transaction that matches a confirmed Akahu transaction
 * Matching criteria: same account, ±5 days, ±30% amount, similar description
 */
async function findMatchingPending(
    accountId: string,
    akahuTx: AkahuTransaction
): Promise<{ id: string; allocations: { id: string; amount: { toNumber(): number } }[] } | null> {
    const txDate = new Date(akahuTx.date);
    const fiveDaysAgo = new Date(txDate);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAhead = new Date(txDate);
    fiveDaysAhead.setDate(fiveDaysAhead.getDate() + 5);

    const pendingCandidates = await prisma.transaction.findMany({
        where: {
            accountId,
            status: 'pending',
            date: {
                gte: fiveDaysAgo,
                lte: fiveDaysAhead,
            },
        },
        include: { allocations: true },
    });

    // Find best match based on amount and description similarity
    for (const pending of pendingCandidates) {
        const pendingAmount = Number(pending.amount);
        const akahuAmount = akahuTx.amount;

        // Amount within ±30%
        const amountDiff = Math.abs(pendingAmount - akahuAmount);
        const tolerance = Math.abs(pendingAmount) * 0.3;
        if (amountDiff > tolerance) continue;

        // Description should contain some common substring (case-insensitive)
        const pendingDesc = (pending.description || '').toLowerCase();
        const akahuDesc = akahuTx.description.toLowerCase();
        if (!descriptionsSimilar(pendingDesc, akahuDesc)) continue;

        return pending;
    }

    return null;
}

/**
 * Check if two descriptions are similar (case-insensitive contains check)
 */
function descriptionsSimilar(desc1: string, desc2: string): boolean {
    // If either contains the other, or they share a significant substring
    if (desc1.includes(desc2) || desc2.includes(desc1)) return true;

    // Check for common words (at least 3 chars)
    const words1 = desc1.split(/\s+/).filter(w => w.length >= 3);
    const words2 = desc2.split(/\s+/).filter(w => w.length >= 3);

    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2) return true;
        }
    }

    return false;
}

/**
 * Confirm a pending transaction when its confirmed version arrives
 * - Updates status to confirmed
 * - Updates amount and externalId
 * - Handles allocations (single: update amount, multi: delete all)
 */
async function confirmPendingTransaction(
    pending: { id: string; allocations: { id: string; amount: { toNumber(): number } }[] },
    akahuTx: AkahuTransaction
): Promise<void> {
    const hasMultipleAllocations = pending.allocations.length > 1;
    const hasSingleAllocation = pending.allocations.length === 1;

    if (hasMultipleAllocations) {
        // Multi-bucket split: delete all allocations, user must reallocate
        await prisma.allocation.deleteMany({
            where: { transactionId: pending.id },
        });
    } else if (hasSingleAllocation) {
        // Single allocation: update amount to match confirmed
        await prisma.allocation.update({
            where: { id: pending.allocations[0].id },
            data: { amount: akahuTx.amount },
        });
    }

    // Update transaction to confirmed
    await prisma.transaction.update({
        where: { id: pending.id },
        data: {
            externalId: akahuTx._id,
            amount: akahuTx.amount,
            merchant: akahuTx.merchant?.name || extractMerchant(akahuTx.description),
            description: akahuTx.description,
            category: akahuTx.category?.name || null,
            balance: akahuTx.balance ?? null,
            status: 'confirmed',
            isAmended: pending.allocations.length > 0 && Number(pending.allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0)) !== akahuTx.amount,
        },
    });
}
