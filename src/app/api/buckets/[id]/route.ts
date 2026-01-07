import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/buckets/:id
 * Get bucket details with budget allocations and transaction allocations
 */
export async function GET(request: Request, { params }: RouteParams) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch bucket with allocations
    const bucket = await prisma.bucket.findFirst({
        where: {
            id,
            group: { userId: user.id },
        },
        include: {
            budgetAllocations: {
                orderBy: { createdAt: 'desc' },
            },
            allocations: {
                include: {
                    transaction: {
                        select: {
                            id: true,
                            merchant: true,
                            amount: true,
                            date: true,
                        },
                    },
                },
                orderBy: { transaction: { date: 'desc' } },
            },
        },
    });

    if (!bucket) {
        return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    return NextResponse.json({
        id: bucket.id,
        name: bucket.name,
        color: bucket.color,
        type: bucket.type,
        budgetAllocations: bucket.budgetAllocations.map((ba) => ({
            id: ba.id,
            amount: Number(ba.amount),
            note: ba.note,
            createdAt: ba.createdAt.toISOString(),
        })),
        transactionAllocations: bucket.allocations.map((a) => ({
            id: a.id,
            transactionId: a.transactionId,
            amount: Number(a.amount),
            merchant: a.transaction.merchant,
            date: a.transaction.date.toISOString(),
        })),
    });
}

export async function PATCH(request: Request, { params }: RouteParams) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership through group
    const existing = await prisma.bucket.findFirst({
        where: {
            id,
            group: { userId: user.id },
        },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { name, type, icon, color, autoAllocationAmount, rollover, rolloverTargetId, groupId } =
        body;

    // If changing group, verify new group belongs to user
    if (groupId && groupId !== existing.groupId) {
        const newGroup = await prisma.bucketGroup.findFirst({
            where: { id: groupId, userId: user.id },
        });
        if (!newGroup) {
            return NextResponse.json({ error: 'Target group not found' }, { status: 404 });
        }
    }

    const updated = await prisma.bucket.update({
        where: { id },
        data: {
            name,
            type,
            icon,
            color,
            autoAllocationAmount,
            rollover,
            rolloverTargetId,
            groupId,
        },
    });

    return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: RouteParams) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership through group
    const existing = await prisma.bucket.findFirst({
        where: {
            id,
            group: { userId: user.id },
        },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft delete: rename, mark as deleted, and remove rules/scheduled transactions
    // Note: Allocations are NOT deleted to preserve history
    await prisma.$transaction([
        // Delete categorization rules
        prisma.categorizationRule.deleteMany({
            where: { bucketId: id },
        }),
        // Delete scheduled transactions
        prisma.scheduledTransaction.deleteMany({
            where: { bucketId: id },
        }),
        // Update bucket (soft delete)
        prisma.bucket.update({
            where: { id },
            data: {
                name: `DELETED: ${existing.name}`,
                isDeleted: true,
            },
        }),
    ]);

    return NextResponse.json({ success: true });
}
