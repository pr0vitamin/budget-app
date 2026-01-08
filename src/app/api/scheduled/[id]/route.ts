import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { calculateNextDue } from '@/lib/scheduled-utils';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PATCH /api/scheduled/:id
 * Update a scheduled transaction
 */
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

    // Get existing and verify ownership
    const existing = await prisma.scheduledTransaction.findUnique({
        where: { id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If bucketId is being changed, verify new bucket
    if (body.bucketId && body.bucketId !== existing.bucketId) {
        const bucket = await prisma.bucket.findFirst({
            where: { id: body.bucketId },
            include: { group: { select: { userId: true } } },
        });

        if (!bucket || bucket.group.userId !== user.id) {
            return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
        }
    }

    // Build update data
    const updateData: {
        name?: string;
        amount?: number;
        bucketId?: string;
        frequency?: string;
        interval?: number;
        startDate?: Date;
        nextDue?: Date;
        enabled?: boolean;
    } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.bucketId !== undefined) updateData.bucketId = body.bucketId;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.interval !== undefined) updateData.interval = body.interval;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    // Recalculate nextDue if frequency, interval, or startDate changes
    if (body.startDate !== undefined || body.frequency !== undefined || body.interval !== undefined) {
        // Parse date as noon UTC to avoid timezone day-shift issues
        const startDate = body.startDate ? new Date(`${body.startDate}T12:00:00Z`) : existing.startDate;
        const frequency = body.frequency ?? existing.frequency;
        const interval = body.interval ?? existing.interval;

        updateData.startDate = startDate;
        updateData.nextDue = calculateNextDue(startDate, frequency, interval);
    }

    const updated = await prisma.scheduledTransaction.update({
        where: { id },
        data: updateData,
        include: {
            bucket: {
                select: { id: true, name: true, color: true },
            },
        },
    });

    return NextResponse.json({
        ...updated,
        amount: Number(updated.amount),
    });
}

/**
 * DELETE /api/scheduled/:id
 * Delete a scheduled transaction
 */
export async function DELETE(request: Request, { params }: RouteParams) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get existing and verify ownership
    const existing = await prisma.scheduledTransaction.findUnique({
        where: { id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.scheduledTransaction.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
