import { prisma } from '@/lib/db';

/**
 * Calculate the "Available to Budget" amount for a user.
 * This is the sum of all positive (income) transactions that are not yet allocated.
 */
export async function calculateAvailableToBudget(userId: string): Promise<number> {
    // Get user's accounts
    const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Find unallocated positive transactions (income)
    const unallocatedIncome = await prisma.transaction.findMany({
        where: {
            OR: [
                { accountId: { in: accountIds } },
                { accountId: null, isManual: true },
            ],
            amount: { gt: 0 }, // Positive = income
            allocations: { none: {} }, // No allocations yet
        },
        select: { amount: true },
    });

    // Sum up unallocated income
    const total = unallocatedIncome.reduce((sum, t) => sum + Number(t.amount), 0);

    return total;
}

/**
 * Get the count of unallocated transactions for inbox badge
 */
export async function getUnallocatedCount(userId: string): Promise<number> {
    // Get user's accounts
    const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const count = await prisma.transaction.count({
        where: {
            OR: [
                { accountId: { in: accountIds } },
                { accountId: null, isManual: true },
            ],
            allocations: { none: {} },
        },
    });

    return count;
}
