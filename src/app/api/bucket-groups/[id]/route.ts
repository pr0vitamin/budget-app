import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
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
    const { name } = body;

    // Verify ownership
    const existing = await prisma.bucketGroup.findFirst({
        where: { id, userId: user.id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.bucketGroup.update({
        where: { id },
        data: { name },
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

    // Verify ownership and check for active cats
    const existing = await prisma.bucketGroup.findFirst({
        where: { id, userId: user.id },
        include: {
            buckets: {
                where: { isDeleted: false }, // Only count active cats
            },
        },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Clowder not found' }, { status: 404 });
    }

    // Check if group has any active cats
    if (existing.buckets.length > 0) {
        return NextResponse.json(
            { error: `Cannot delete clowder with ${existing.buckets.length} active cat(s). Delete all cats first.` },
            { status: 400 }
        );
    }

    await prisma.bucketGroup.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
