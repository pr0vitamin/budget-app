import { AppShell } from '@/components/layout';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ensureUserExists } from '@/lib/ensure-user';
import { InboxPageClient } from './InboxPageClient';

export default async function InboxPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null; // Middleware will redirect
    }

    // Ensure user exists in Prisma database
    await ensureUserExists(user);

    // Get user's accounts
    const userAccounts = await prisma.account.findMany({
        where: { userId: user.id },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
        where: {
            OR: [
                { accountId: { in: accountIds } },
                { accountId: null, isManual: true },
            ],
        },
        include: {
            account: { select: { id: true, name: true, institution: true } },
            allocations: {
                include: {
                    bucket: { select: { id: true, name: true, color: true } },
                },
            },
        },
        orderBy: { date: 'desc' },
        take: 50,
    });

    // Count unallocated
    const unallocatedCount = transactions.filter((t) => t.allocations.length === 0 && Number(t.amount) < 0).length;

    // Format for client
    const formattedTransactions = transactions.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        merchant: t.merchant || 'Unknown',
        date: t.date.toISOString(),
        description: t.description || undefined,
        isManual: t.isManual,
        allocations: t.allocations.map((a) => ({
            bucket: {
                id: a.bucket.id,
                name: a.bucket.name,
                color: a.bucket.color,
            },
            amount: Number(a.amount),
        })),
    }));

    return (
        <AppShell>
            <InboxPageClient
                transactions={formattedTransactions}
                unallocatedCount={unallocatedCount}
                hasMore={transactions.length >= 50}
            />
        </AppShell>
    );
}
