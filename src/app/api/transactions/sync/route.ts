import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllAccountTransactions } from '@/lib/sync-transactions';

/**
 * POST /api/transactions/sync
 * Sync transactions from all connected Akahu accounts
 * This is NOT rate-limited - we can query Akahu as often as we want
 * 
 * Body: { initialDays?: number } - How many days to fetch for first-time syncs (default 30, max 30)
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional initialDays from body
    let initialDays = 30;
    try {
        const body = await request.json();
        if (body.initialDays && typeof body.initialDays === 'number') {
            initialDays = Math.min(Math.max(1, body.initialDays), 30);
        }
    } catch {
        // No body or invalid JSON, use default
    }

    try {
        const result = await syncAllAccountTransactions(user.id, initialDays);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error syncing transactions:', error);

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync transactions' },
            { status: 500 }
        );
    }
}
