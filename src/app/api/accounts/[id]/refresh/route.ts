import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { refreshAccount } from '@/lib/akahu';

// Rate limit: 1 refresh per hour per account (Akahu's limit)
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/accounts/:id/refresh
 * Trigger a data refresh from the bank via Akahu
 * This is rate-limited to once per hour by Akahu
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

    // Check rate limit for refresh
    if (account.lastSyncAt) {
        const timeSinceLastRefresh = Date.now() - account.lastSyncAt.getTime();
        if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
            const remainingMs = REFRESH_COOLDOWN_MS - timeSinceLastRefresh;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return NextResponse.json(
                { error: `Rate limited. Try again in ${remainingMinutes} minutes.`, remainingMs },
                { status: 429 }
            );
        }
    }

    try {
        // Call Akahu to refresh data from the bank
        await refreshAccount(account.akahuId);

        // Update last refresh timestamp
        await prisma.account.update({
            where: { id: accountId },
            data: {
                lastSyncAt: new Date(),
                connectionError: null,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Bank data refresh triggered. New transactions may take a few minutes to appear.',
            lastRefreshAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error refreshing account:', error);

        await prisma.account.update({
            where: { id: accountId },
            data: { connectionError: error instanceof Error ? error.message : 'Refresh failed' },
        });

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to refresh account' },
            { status: 500 }
        );
    }
}
