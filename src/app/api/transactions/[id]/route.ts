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

    // Get transaction and verify ownership
    const existing = await prisma.transaction.findFirst({
        where: { id },
        include: { account: true },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify ownership through account or manual transaction
    if (existing.account && existing.account.userId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { amount, merchant, date, description } = body;

    const updated = await prisma.transaction.update({
        where: { id },
        data: {
            ...(amount !== undefined && { amount }),
            ...(merchant && { merchant }),
            ...(date && { date: new Date(date) }),
            ...(description !== undefined && { description }),
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

    // Get transaction and verify ownership
    const existing = await prisma.transaction.findFirst({
        where: { id },
        include: { account: true },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Can only delete manual transactions
    if (!existing.isManual) {
        return NextResponse.json(
            { error: 'Cannot delete synced transactions' },
            { status: 400 }
        );
    }

    // Verify ownership through account
    if (existing.account && existing.account.userId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.transaction.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
