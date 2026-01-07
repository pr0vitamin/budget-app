import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import ScheduledPageClient from './ScheduledPageClient';

export default async function ScheduledPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch scheduled transactions with bucket info
    const scheduled = await prisma.scheduledTransaction.findMany({
        where: { userId: user.id },
        include: {
            bucket: {
                select: { id: true, name: true, color: true },
            },
        },
        orderBy: { nextDue: 'asc' },
    });

    // Fetch bucket groups for the form
    const bucketGroups = await prisma.bucketGroup.findMany({
        where: { userId: user.id },
        include: {
            buckets: {
                select: { id: true, name: true, color: true },
                orderBy: { sortOrder: 'asc' },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });

    // Format for props
    const formattedScheduled = scheduled.map((s) => ({
        id: s.id,
        name: s.name,
        amount: Number(s.amount),
        frequency: s.frequency,
        interval: s.interval,
        nextDue: s.nextDue.toISOString(),
        startDate: s.startDate.toISOString(),
        enabled: s.enabled,
        bucket: s.bucket,
    }));

    return <ScheduledPageClient scheduled={formattedScheduled} bucketGroups={bucketGroups} />;
}
