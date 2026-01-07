import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/budget/allocations
 * List all budget allocations for the current user
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allocations = await prisma.budgetAllocation.findMany({
        where: { userId: user.id },
        include: {
            bucket: {
                select: { id: true, name: true, color: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
        allocations: allocations.map((a) => ({
            id: a.id,
            bucketId: a.bucketId,
            bucketName: a.bucket.name,
            bucketColor: a.bucket.color,
            amount: Number(a.amount),
            note: a.note,
            createdAt: a.createdAt.toISOString(),
        })),
    });
}

/**
 * POST /api/budget/allocations
 * Create a new budget allocation (feed a bucket)
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
    const { bucketId, amount, note } = body;

    if (!bucketId || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Verify bucket belongs to user
    const bucket = await prisma.bucket.findFirst({
        where: { id: bucketId, group: { userId: user.id } },
    });

    if (!bucket) {
        return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    // Check available budget
    const incomeResult = await prisma.transaction.aggregate({
        where: { account: { userId: user.id }, amount: { gt: 0 } },
        _sum: { amount: true },
    });
    const allocationsResult = await prisma.budgetAllocation.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
    });
    const availableToBudget = Number(incomeResult._sum.amount || 0) - Number(allocationsResult._sum.amount || 0);

    if (amount > availableToBudget) {
        return NextResponse.json({ error: 'Insufficient funds available to budget' }, { status: 400 });
    }

    const allocation = await prisma.budgetAllocation.create({
        data: {
            userId: user.id,
            bucketId,
            amount,
            note: note || null,
        },
    });

    return NextResponse.json({
        id: allocation.id,
        bucketId: allocation.bucketId,
        amount: Number(allocation.amount),
        note: allocation.note,
    });
}
