import { prisma } from '@/lib/db';

/**
 * Calculate the "Available to Budget" amount for a user.
 * This is: Total Income (positive transactions) - Total Budget Allocations
 * 
 * Income transactions are NOT allocated to individual buckets.
 * Instead, they form a pool that can be "fed" to buckets via BudgetAllocation.
 */
export async function calculateAvailableToBudget(userId: string): Promise<number> {
    // Get user's accounts
    const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Sum all income transactions (positive amounts)
    const incomeResult = await prisma.transaction.aggregate({
        where: {
            OR: [
                { accountId: { in: accountIds } },
                { accountId: null, isManual: true },
            ],
            amount: { gt: 0 }, // Positive = income
        },
        _sum: { amount: true },
    });

    // Sum all budget allocations (money already allocated to buckets)
    const allocationsResult = await prisma.budgetAllocation.aggregate({
        where: { userId },
        _sum: { amount: true },
    });

    const totalIncome = Number(incomeResult._sum.amount || 0);
    const totalAllocated = Number(allocationsResult._sum.amount || 0);

    return totalIncome - totalAllocated;
}

/**
 * Get the count of unallocated expense transactions for inbox badge
 * Note: Income transactions are NOT counted as they don't need allocation
 */
export async function getUnallocatedCount(userId: string): Promise<number> {
    // Get user's accounts
    const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Only count expense transactions (negative amounts) that are unallocated
    const count = await prisma.transaction.count({
        where: {
            OR: [
                { accountId: { in: accountIds } },
                { accountId: null, isManual: true },
            ],
            amount: { lt: 0 }, // Only expenses need allocation
            allocations: { none: {} },
        },
    });

    return count;
}
