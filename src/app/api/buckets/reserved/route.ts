import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getPeriodEndDate, BudgetCycleConfig } from '@/lib/budget-utils';

/**
 * GET /api/buckets/reserved
 * Returns the reserved (upcoming scheduled) amounts per bucket
 * Only considers enabled scheduled transactions due within the current budget cycle
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's budget cycle settings
    const settings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { budgetCycleType: true, budgetCycleStartDay: true },
    });

    const cycleConfig: BudgetCycleConfig = {
        type: (settings?.budgetCycleType as 'weekly' | 'fortnightly' | 'monthly') || 'monthly',
        startDay: settings?.budgetCycleStartDay ?? 1,
    };

    // Get end of current budget cycle
    const cycleEnd = getPeriodEndDate(cycleConfig);

    // Get all enabled scheduled transactions for this user
    const scheduled = await prisma.scheduledTransaction.findMany({
        where: {
            userId: user.id,
            enabled: true,
        },
        select: {
            bucketId: true,
            amount: true,
            nextDue: true,
        },
    });

    // Calculate reserved amounts per bucket (sum of scheduled amounts due within current cycle)
    const reservedByBucket: Record<string, number> = {};

    for (const item of scheduled) {
        if (item.nextDue <= cycleEnd) {
            const amount = Math.abs(Number(item.amount));
            reservedByBucket[item.bucketId] = (reservedByBucket[item.bucketId] || 0) + amount;
        }
    }

    return NextResponse.json({ reserved: reservedByBucket });
}

