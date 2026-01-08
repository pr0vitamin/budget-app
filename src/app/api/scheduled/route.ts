import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { calculateNextDue } from '@/lib/scheduled-utils';

/**
 * GET /api/scheduled
 * List all scheduled transactions for the user
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduled = await prisma.scheduledTransaction.findMany({
        where: { userId: user.id },
        include: {
            bucket: {
                select: { id: true, name: true, color: true },
            },
        },
        orderBy: { nextDue: 'asc' },
    });

    // Format for JSON response
    const formatted = scheduled.map((s) => ({
        ...s,
        amount: Number(s.amount),
    }));

    return NextResponse.json(formatted);
}

/**
 * POST /api/scheduled
 * Create a new scheduled transaction
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bucketId, name, amount, frequency, interval, startDate } = body;

    // Validate required fields
    if (!bucketId || !name || amount === undefined || !frequency || !startDate) {
        return NextResponse.json(
            { error: 'bucketId, name, amount, frequency, and startDate are required' },
            { status: 400 }
        );
    }

    // Verify bucket exists and belongs to user
    const bucket = await prisma.bucket.findFirst({
        where: { id: bucketId },
        include: { group: { select: { userId: true } } },
    });

    if (!bucket || bucket.group.userId !== user.id) {
        return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    // Validate frequency
    const validFrequencies = ['weekly', 'fortnightly', 'monthly', 'yearly', 'custom'];
    if (!validFrequencies.includes(frequency)) {
        return NextResponse.json(
            { error: 'Invalid frequency. Must be: weekly, fortnightly, monthly, yearly, or custom' },
            { status: 400 }
        );
    }

    // Parse date as noon UTC to avoid timezone day-shift issues
    // When user selects "2026-01-23", we store it as noon UTC so it displays as Jan 23 in all timezones
    const parsedStartDate = new Date(`${startDate}T12:00:00Z`);
    const nextDue = calculateNextDue(parsedStartDate, frequency, interval || 1);

    const scheduled = await prisma.scheduledTransaction.create({
        data: {
            userId: user.id,
            bucketId,
            name,
            amount,
            frequency,
            interval: interval || 1,
            startDate: parsedStartDate,
            nextDue,
            enabled: true,
        },
        include: {
            bucket: {
                select: { id: true, name: true, color: true },
            },
        },
    });

    return NextResponse.json({
        ...scheduled,
        amount: Number(scheduled.amount),
    });
}
