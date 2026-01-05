import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get buckets with their allocations to calculate balances
    const buckets = await prisma.bucket.findMany({
        where: {
            group: {
                userId: user.id,
            },
        },
        include: {
            group: true,
            allocations: {
                include: {
                    transaction: true,
                },
            },
        },
        orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    // Calculate balance for each bucket
    const bucketsWithBalances = buckets.map((bucket) => {
        const balance = bucket.allocations.reduce((sum, allocation) => {
            return sum.add(allocation.amount);
        }, new Prisma.Decimal(0));

        return {
            id: bucket.id,
            groupId: bucket.groupId,
            name: bucket.name,
            type: bucket.type,
            icon: bucket.icon,
            color: bucket.color,
            autoAllocationAmount: bucket.autoAllocationAmount,
            rollover: bucket.rollover,
            rolloverTargetId: bucket.rolloverTargetId,
            sortOrder: bucket.sortOrder,
            balance: balance.toNumber(),
            group: bucket.group,
        };
    });

    return NextResponse.json(bucketsWithBalances);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId, name, type, icon, color, autoAllocationAmount, rollover, rolloverTargetId } =
        body;

    if (!groupId || !name) {
        return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 });
    }

    // Verify group belongs to user
    const group = await prisma.bucketGroup.findFirst({
        where: { id: groupId, userId: user.id },
    });

    if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get max sort order in group
    const maxSortOrder = await prisma.bucket.aggregate({
        where: { groupId },
        _max: { sortOrder: true },
    });

    const bucket = await prisma.bucket.create({
        data: {
            groupId,
            name,
            type: type || 'spending',
            icon,
            color: color || '#6366f1',
            autoAllocationAmount: autoAllocationAmount || 0,
            rollover: rollover ?? true,
            rolloverTargetId,
            sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        },
    });

    return NextResponse.json({ ...bucket, balance: 0 }, { status: 201 });
}
