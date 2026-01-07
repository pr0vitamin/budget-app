import { AppShell } from '@/components/layout';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ensureUserExists } from '@/lib/ensure-user';
import { SettingsPageClient } from './SettingsPageClient';

export default async function SettingsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null; // Middleware will redirect
    }

    // Ensure user exists in Prisma database
    await ensureUserExists(user);

    // Get or create settings
    let settings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
    });

    if (!settings) {
        settings = await prisma.userSettings.create({
            data: {
                userId: user.id,
                budgetCycleType: 'fortnightly',
                budgetCycleStartDate: new Date(),
            },
        });
    }

    // Get connected accounts
    const accounts = await prisma.account.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
    });

    const formattedAccounts = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        accountType: a.accountType,
        formattedAccount: a.formattedAccount,
        balanceCurrent: a.balanceCurrent ? Number(a.balanceCurrent) : null,
        status: a.status,
        connectionLogo: a.connectionLogo,
        lastSyncAt: a.lastSyncAt?.toISOString() || null,
        connectionError: a.connectionError,
    }));

    return (
        <AppShell>
            <SettingsPageClient
                userEmail={user.email || ''}
                settings={{
                    budgetCycleType: settings.budgetCycleType,
                    budgetCycleStartDate: settings.budgetCycleStartDate.toISOString(),
                }}
                accounts={formattedAccounts}
            />
        </AppShell>
    );
}

