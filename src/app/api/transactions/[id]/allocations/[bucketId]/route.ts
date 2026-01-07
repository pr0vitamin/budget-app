import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/transactions/:txId/allocations/:bucketId
 * Remove allocation of a transaction from a specific bucket
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; bucketId: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId, bucketId } = await params;

    // Verify the allocation belongs to the user
    const allocation = await prisma.allocation.findFirst({
        where: {
            transactionId,
            bucketId,
            transaction: {
                OR: [
                    { account: { userId: user.id } },
                    { accountId: null, isManual: true },
                ],
            },
        },
    });

    if (!allocation) {
        return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    await prisma.allocation.delete({
        where: {
            transactionId_bucketId: {
                transactionId,
                bucketId,
            },
        },
    });

    return NextResponse.json({ success: true });
}
