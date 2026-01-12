import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getAccounts as getAkahuAccounts, AkahuAccount } from '@/lib/akahu';

/**
 * GET /api/accounts
 * List user's connected bank accounts
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(accounts);
}

/**
 * POST /api/accounts/sync-from-akahu
 * Sync accounts from Akahu and store in database
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
        // Fetch accounts from Akahu
        const akahuAccounts = await getAkahuAccounts();

        // Upsert each account into our database
        const results = await Promise.all(
            akahuAccounts.map(async (akahuAccount: AkahuAccount) => {
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

        return NextResponse.json({
            success: true,
            count: results.length,
            accounts: results,
        });
    } catch (error) {
        console.error('Error syncing accounts from Akahu:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync accounts' },
            { status: 500 }
        );
    }
}
