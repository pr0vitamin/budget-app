import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bucketGroups = await prisma.bucketGroup.findMany({
        where: { userId: user.id },
        include: {
            buckets: {
                where: { isDeleted: false },
                orderBy: { sortOrder: 'asc' },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(bucketGroups);
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
    const { name } = body;

    if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get the max sort order for the user's groups
    const maxSortOrder = await prisma.bucketGroup.aggregate({
        where: { userId: user.id },
        _max: { sortOrder: true },
    });

    const bucketGroup = await prisma.bucketGroup.create({
        data: {
            userId: user.id,
            name,
            sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        },
    });

    return NextResponse.json(bucketGroup, { status: 201 });
}
