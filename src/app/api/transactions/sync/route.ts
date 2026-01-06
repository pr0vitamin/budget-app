import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { syncAllAccountTransactions } from '@/lib/sync-transactions';

/**
 * POST /api/transactions/sync
 * Sync transactions from all connected Akahu accounts
 * This is NOT rate-limited - we can query Akahu as often as we want
 */
export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await syncAllAccountTransactions(user.id);

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
