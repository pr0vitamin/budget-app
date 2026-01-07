import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId, orderedIds } = body;

    if (!groupId || !Array.isArray(orderedIds)) {
        return NextResponse.json(
            { error: 'groupId and orderedIds array are required' },
            { status: 400 }
        );
    }

    // Verify group belongs to user
    const group = await prisma.bucketGroup.findFirst({
        where: { id: groupId, userId: user.id },
    });

    if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Verify all bucket IDs belong to this group
    const buckets = await prisma.bucket.findMany({
        where: {
            id: { in: orderedIds },
            groupId,
            isDeleted: false,
        },
    });

    if (buckets.length !== orderedIds.length) {
        return NextResponse.json({ error: 'Invalid bucket IDs' }, { status: 400 });
    }

    // Update sort orders
    await prisma.$transaction(
        orderedIds.map((id, index) =>
            prisma.bucket.update({
                where: { id },
                data: { sortOrder: index },
            })
        )
    );

    return NextResponse.json({ success: true });
}
