import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

interface AllocationInput {
    bucketId: string;
    amount: number;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;
    const body = await request.json();
    const { allocations } = body as { allocations: AllocationInput[] };

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
        return NextResponse.json({ error: 'Allocations array is required' }, { status: 400 });
    }

    // Get the transaction and verify ownership
    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
            account: { select: { userId: true } },
        },
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check ownership - either through account or manual transaction
    const isOwner =
        (transaction.account && transaction.account.userId === user.id) ||
        (transaction.isManual && !transaction.accountId);

    if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify all buckets exist and belong to user
    const bucketIds = allocations.map((a) => a.bucketId);
    const buckets = await prisma.bucket.findMany({
        where: { id: { in: bucketIds } },
        include: { group: { select: { userId: true } } },
    });

    if (buckets.length !== bucketIds.length) {
        return NextResponse.json({ error: 'One or more buckets not found' }, { status: 404 });
    }

    const allBucketsOwned = buckets.every((b) => b.group.userId === user.id);
    if (!allBucketsOwned) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate that allocations sum equals transaction amount
    const transactionAmount = Number(transaction.amount);
    const allocationSum = allocations.reduce((sum, a) => sum + a.amount, 0);

    // Allow small floating point differences (0.01)
    if (Math.abs(transactionAmount - allocationSum) > 0.01) {
        return NextResponse.json(
            { error: `Allocations sum (${allocationSum}) must equal transaction amount (${transactionAmount})` },
            { status: 400 }
        );
    }

    // Delete existing allocations and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
        // Remove existing allocations
        await tx.allocation.deleteMany({
            where: { transactionId },
        });

        // Create new allocations
        await tx.allocation.createMany({
            data: allocations.map((a) => ({
                transactionId,
                bucketId: a.bucketId,
                amount: a.amount,
            })),
        });
    });

    // Fetch updated transaction with allocations
    const updatedTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
            allocations: {
                include: {
                    bucket: { select: { id: true, name: true, color: true } },
                },
            },
        },
    });

    return NextResponse.json(updatedTransaction);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;

    // Get the transaction and verify ownership
    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
            account: { select: { userId: true } },
        },
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const isOwner =
        (transaction.account && transaction.account.userId === user.id) ||
        (transaction.isManual && !transaction.accountId);

    if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete all allocations
    await prisma.allocation.deleteMany({
        where: { transactionId },
    });

    return NextResponse.json({ success: true });
}
