import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { calculateAvailableToBudget } from '@/lib/calculate-available';

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

    // Verify bucket belongs to user and is not deleted
    const bucket = await prisma.bucket.findFirst({
        where: { id: bucketId, group: { userId: user.id }, isDeleted: false },
    });

    if (!bucket) {
        return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    // Check available budget using consistent calculation
    const availableToBudget = await calculateAvailableToBudget(user.id);

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
