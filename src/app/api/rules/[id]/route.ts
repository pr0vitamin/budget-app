import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get rule and verify ownership
    const rule = await prisma.categorizationRule.findUnique({
        where: { id },
    });

    if (!rule) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (rule.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.categorizationRule.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
