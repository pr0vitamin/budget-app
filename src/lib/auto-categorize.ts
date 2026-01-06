import { prisma } from '@/lib/db';

interface Rule {
    id: string;
    merchantPattern: string;
    bucketId: string;
}

interface Transaction {
    id: string;
    merchant: string | null;
    amount: number;
}

/**
 * Find a matching categorization rule for a transaction based on merchant name.
 * Matching is case-insensitive and uses substring matching.
 */
export function findMatchingRule(
    transaction: Transaction,
    rules: Rule[]
): Rule | null {
    if (!transaction.merchant) {
        return null;
    }

    const merchantLower = transaction.merchant.toLowerCase();

    // Find first matching rule (patterns are stored lowercase)
    for (const rule of rules) {
        if (merchantLower.includes(rule.merchantPattern)) {
            return rule;
        }
    }

    return null;
}

/**
 * Apply categorization rules to a transaction.
 * Creates an allocation if a matching rule is found.
 * Returns true if auto-allocation was applied.
 */
export async function applyCategorizationRules(
    transactionId: string,
    userId: string
): Promise<boolean> {
    // Get the transaction
    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { allocations: true },
    });

    if (!transaction) {
        return false;
    }

    // Skip if already has allocations
    if (transaction.allocations.length > 0) {
        return false;
    }

    // Get user's rules
    const rules = await prisma.categorizationRule.findMany({
        where: { userId },
    });

    if (rules.length === 0) {
        return false;
    }

    // Find matching rule
    const matchingRule = findMatchingRule(
        {
            id: transaction.id,
            merchant: transaction.merchant,
            amount: Number(transaction.amount),
        },
        rules
    );

    if (!matchingRule) {
        return false;
    }

    // Create allocation for the full transaction amount
    await prisma.allocation.create({
        data: {
            transactionId,
            bucketId: matchingRule.bucketId,
            amount: transaction.amount,
        },
    });

    return true;
}
