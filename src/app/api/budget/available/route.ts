import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/budget/available
 * Returns the amount available to budget (income - budget allocations)
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sum of all income transactions (positive amounts)
    const incomeResult = await prisma.transaction.aggregate({
        where: {
            account: { userId: user.id },
            amount: { gt: 0 },
        },
        _sum: { amount: true },
    });

    // Sum of all budget allocations
    const allocationsResult = await prisma.budgetAllocation.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
    });

    const totalIncome = Number(incomeResult._sum.amount || 0);
    const totalAllocated = Number(allocationsResult._sum.amount || 0);
    const availableToBudget = totalIncome - totalAllocated;

    return NextResponse.json({
        totalIncome,
        totalAllocated,
        availableToBudget,
    });
}
