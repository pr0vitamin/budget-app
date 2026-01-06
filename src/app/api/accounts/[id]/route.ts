import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/accounts/:id
 * Remove a connected bank account and all its transactions
 */
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

    const { id: accountId } = await params;

    // Get the account and verify ownership
    const account = await prisma.account.findUnique({
        where: { id: accountId },
    });

    if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the account (transactions will cascade delete due to schema)
    await prisma.account.delete({
        where: { id: accountId },
    });

    return NextResponse.json({
        success: true,
        message: 'Account removed successfully',
    });
}
