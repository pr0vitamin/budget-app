import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { applyCategorizationRules } from '@/lib/auto-categorize';

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unallocatedOnly = searchParams.get('unallocated') === 'true';

    // Get accounts belonging to user
    const userAccounts = await prisma.account.findMany({
        where: { userId: user.id },
        select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Build where clause
    const where = {
        OR: [
            { accountId: { in: accountIds } },
            { accountId: null, isManual: true },
        ],
        ...(unallocatedOnly && {
            allocations: { none: {} },
        }),
    };

    const transactions = await prisma.transaction.findMany({
        where,
        include: {
            account: { select: { id: true, name: true, institution: true } },
            allocations: {
                include: {
                    bucket: { select: { id: true, name: true, color: true } },
                },
            },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
    });

    return NextResponse.json(transactions);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, merchant, date, description, accountId } = body;

    if (typeof amount !== 'number' || !merchant) {
        return NextResponse.json({ error: 'amount and merchant are required' }, { status: 400 });
    }

    // If accountId provided, verify ownership
    if (accountId) {
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId: user.id },
        });
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
    }

    const transaction = await prisma.transaction.create({
        data: {
            accountId,
            externalId: `manual_${Date.now()}`,
            amount,
            date: new Date(date || Date.now()),
            merchant,
            description,
            isManual: true,
        },
        include: {
            account: true,
        },
    });

    // Try to auto-categorize based on rules
    await applyCategorizationRules(transaction.id, user.id);

    return NextResponse.json(transaction, { status: 201 });
}
