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

    // Verify ownership
    const existing = await prisma.bucketGroup.findFirst({
        where: { id, userId: user.id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.bucketGroup.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
