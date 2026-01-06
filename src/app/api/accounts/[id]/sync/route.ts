import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { syncAccountTransactions } from '@/lib/sync-transactions';

// Rate limit: 1 sync per hour per account
const SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/accounts/:id/sync
 * Trigger transaction sync for a specific account
 */
export async function POST(
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

    // Check rate limit
    if (account.lastSyncAt) {
        const timeSinceLastSync = Date.now() - account.lastSyncAt.getTime();
        if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
            const remainingMs = SYNC_COOLDOWN_MS - timeSinceLastSync;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return NextResponse.json(
                { error: `Rate limited. Try again in ${remainingMinutes} minutes.`, remainingMs },
                { status: 429 }
            );
        }
    }

    try {
        const result = await syncAccountTransactions(accountId, user.id);

        return NextResponse.json({
            success: true,
            ...result,
            lastSyncAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error syncing transactions:', error);

        // Store error on account
        await prisma.account.update({
            where: { id: accountId },
            data: { connectionError: error instanceof Error ? error.message : 'Sync failed' },
        });

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync transactions' },
            { status: 500 }
        );
    }
}
