import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/buckets/reserved
 * Returns the reserved (upcoming scheduled) amounts per bucket
 * Only considers enabled scheduled transactions due within 30 days
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Calculate reserved amounts per bucket (sum of scheduled amounts due within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const reservedByBucket: Record<string, number> = {};

    for (const item of scheduled) {
        if (item.nextDue <= thirtyDaysFromNow) {
            const amount = Math.abs(Number(item.amount));
            reservedByBucket[item.bucketId] = (reservedByBucket[item.bucketId] || 0) + amount;
        }
    }

    return NextResponse.json({ reserved: reservedByBucket });
}
