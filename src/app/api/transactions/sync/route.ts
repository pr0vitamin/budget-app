import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { refreshAccountAndWait, getAccounts as getAkahuAccounts } from '@/lib/akahu';
import { syncAllAccountTransactions } from '@/lib/sync-transactions';
import { syncPendingTransactions } from '@/lib/sync-pending';

// Rate limit: 1 refresh per hour per account (Akahu's limit)
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/transactions/sync
 * Refreshes bank data from Akahu (if not on cooldown), then syncs transactions.
 * Returns cooldown info if all accounts are rate limited.
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

    // Get all user's accounts
    let accounts = await prisma.account.findMany({
        where: { userId: user.id },
        select: { id: true, akahuId: true, lastSyncAt: true },
    });

    // If no accounts, try to sync them from Akahu first
    if (accounts.length === 0) {
        try {
            const akahuAccounts = await getAkahuAccounts();

            if (akahuAccounts.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: 'No bank accounts connected in Akahu',
                    needsConnection: true,
                });
            }

            // Create accounts in database
            await Promise.all(
                akahuAccounts.map(async (akahuAccount) => {
                    return prisma.account.upsert({
                        where: {
                            userId_akahuId: {
                                userId: user.id,
                                akahuId: akahuAccount._id,
                            },
                        },
                        update: {
                            name: akahuAccount.name,
                            institution: akahuAccount.connection.name,
                            accountType: akahuAccount.type.toLowerCase(),
                            formattedAccount: akahuAccount.formatted_account || null,
                            balanceCurrent: akahuAccount.balance?.current ?? null,
                            balanceAvailable: akahuAccount.balance?.available ?? null,
                            currency: akahuAccount.balance?.currency || 'NZD',
                            status: akahuAccount.status,
                            connectionLogo: akahuAccount.connection.logo || null,
                        },
                        create: {
                            userId: user.id,
                            akahuId: akahuAccount._id,
                            name: akahuAccount.name,
                            institution: akahuAccount.connection.name,
                            accountType: akahuAccount.type.toLowerCase(),
                            formattedAccount: akahuAccount.formatted_account || null,
                            balanceCurrent: akahuAccount.balance?.current ?? null,
                            balanceAvailable: akahuAccount.balance?.available ?? null,
                            currency: akahuAccount.balance?.currency || 'NZD',
                            status: akahuAccount.status,
                            connectionLogo: akahuAccount.connection.logo || null,
                        },
                    });
                })
            );

            // Re-fetch accounts after creating them
            accounts = await prisma.account.findMany({
                where: { userId: user.id },
                select: { id: true, akahuId: true, lastSyncAt: true },
            });
        } catch (error) {
            console.error('Error syncing accounts from Akahu:', error);
            return NextResponse.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to connect to Akahu',
            }, { status: 500 });
        }
    }

    // Check cooldown and refresh accounts that aren't limited
    let allOnCooldown = true;
    let minRemainingMs = 0;
    const accountsToSync: string[] = []; // Track accounts that were successfully refreshed

    for (const account of accounts) {
        let isLimited = false;
        let remainingMs = 0;

        if (account.lastSyncAt) {
            const timeSinceLastRefresh = Date.now() - account.lastSyncAt.getTime();
            if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
                isLimited = true;
                remainingMs = REFRESH_COOLDOWN_MS - timeSinceLastRefresh;
                if (minRemainingMs === 0 || remainingMs < minRemainingMs) {
                    minRemainingMs = remainingMs;
                }
            }
        }

        if (!isLimited) {
            allOnCooldown = false;
            try {
                // Refresh data from bank via Akahu and WAIT for completion
                // This polls Akahu until the refresh is complete (up to 30s)
                const refreshResult = await refreshAccountAndWait(account.akahuId, 30000, 2000);

                if (refreshResult.refreshed) {
                    // Track this account for syncing - we'll update lastSyncAt AFTER successful sync
                    accountsToSync.push(account.id);

                    // Clear any previous connection errors
                    await prisma.account.update({
                        where: { id: account.id },
                        data: { connectionError: null },
                    });

                    if (refreshResult.error) {
                        // Partial success - refresh was triggered but confirmation timed out
                        console.warn(`Refresh warning for account ${account.id}: ${refreshResult.error}`);
                    }
                } else {
                    // Refresh failed completely
                    console.error(`Failed to refresh account ${account.id}: ${refreshResult.error}`);
                    await prisma.account.update({
                        where: { id: account.id },
                        data: { connectionError: refreshResult.error || 'Refresh failed' },
                    });
                }
            } catch (error) {
                console.error(`Error refreshing account ${account.id}:`, error);
                await prisma.account.update({
                    where: { id: account.id },
                    data: { connectionError: error instanceof Error ? error.message : 'Refresh failed' },
                });
            }
        }
    }

    // If all accounts are on cooldown, return cooldown info
    if (allOnCooldown) {
        const remainingMinutes = Math.ceil(minRemainingMs / 60000);
        return NextResponse.json({
            success: false,
            onCooldown: true,
            remainingMinutes,
            message: `No new transactions available. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        });
    }

    // No fixed delay needed - refreshAccountAndWait already waited for completion

    // Now sync transactions
    try {
        // Sync pending first, then confirmed (so matching works correctly)
        const pendingResult = await syncPendingTransactions(user.id);
        const result = await syncAllAccountTransactions(user.id, initialDays);

        // SUCCESS: Only now update lastSyncAt for accounts that were refreshed
        // This ensures cooldown only applies if we successfully synced transactions
        if (accountsToSync.length > 0) {
            await prisma.account.updateMany({
                where: { id: { in: accountsToSync } },
                data: { lastSyncAt: new Date() },
            });
        }

        return NextResponse.json({
            success: true,
            refreshedAccounts: accountsToSync.length,
            pendingNew: pendingResult.newCount,
            pendingDeleted: pendingResult.deletedCount,
            ...result,
        });
    } catch (error) {
        console.error('Error syncing transactions:', error);
        // Note: We intentionally do NOT update lastSyncAt here
        // This allows the user to retry without hitting cooldown

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync transactions' },
            { status: 500 }
        );
    }
}
