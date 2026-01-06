import { AppShell } from '@/components/layout';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ensureUserExists } from '@/lib/ensure-user';
import { RulesList } from '@/components/rules';

export default async function RulesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    await ensureUserExists(user);

    const rules = await prisma.categorizationRule.findMany({
        where: { userId: user.id },
        include: {
            bucket: { select: { id: true, name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const formattedRules = rules.map((r) => ({
        id: r.id,
        merchantPattern: r.merchantPattern,
        bucket: r.bucket,
        createdAt: r.createdAt.toISOString(),
    }));

    return (
        <AppShell>
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Auto-Categorization Rules</h1>
                        <p className="text-gray-500 text-sm">
                            Transactions matching these patterns will be auto-allocated.
                        </p>
                    </div>
                </div>

                <RulesList rules={formattedRules} />
            </div>
        </AppShell>
    );
}
