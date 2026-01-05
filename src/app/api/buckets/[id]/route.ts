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

    await prisma.bucket.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
