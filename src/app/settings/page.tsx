import { AppShell } from '@/components/layout';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { SettingsPageClient } from './SettingsPageClient';

export default async function SettingsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null; // Middleware will redirect
    }

    // Get or create settings
    let settings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
    });

    if (!settings) {
        settings = await prisma.userSettings.create({
            data: {
                userId: user.id,
                budgetCycleType: 'fortnightly',
                budgetCycleStartDay: 4,
            },
        });
    }

    // Get accounts count
    const accountsCount = await prisma.account.count({
        where: { userId: user.id },
    });

    return (
        <AppShell>
            <SettingsPageClient
                userEmail={user.email || ''}
                settings={{
                    budgetCycleType: settings.budgetCycleType,
                    budgetCycleStartDay: settings.budgetCycleStartDay,
                }}
                accountsCount={accountsCount}
            />
        </AppShell>
    );
}
