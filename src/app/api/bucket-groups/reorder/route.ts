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
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
        return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    // Verify all IDs belong to user
    const groups = await prisma.bucketGroup.findMany({
        where: {
            id: { in: orderedIds },
            userId: user.id,
        },
    });

    if (groups.length !== orderedIds.length) {
        return NextResponse.json({ error: 'Invalid group IDs' }, { status: 400 });
    }

    // Update sort orders
    await prisma.$transaction(
        orderedIds.map((id, index) =>
            prisma.bucketGroup.update({
                where: { id },
                data: { sortOrder: index },
            })
        )
    );

    return NextResponse.json({ success: true });
}
