import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { calculateAvailableToBudget } from '@/lib/calculate-available';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { allocations } = body;

    // Validate input: allocations should be an array of { bucketId, amount }
    if (!Array.isArray(allocations) || allocations.length === 0) {
        return NextResponse.json({ error: 'Invalid input: allocations array required' }, { status: 400 });
    }

    for (const alloc of allocations) {
        if (!alloc.bucketId || typeof alloc.amount !== 'number' || alloc.amount <= 0) {
            return NextResponse.json({ error: 'Invalid allocation in batch' }, { status: 400 });
        }
    }

    // Calculate total amount needed
    const totalAmount = allocations.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0);

    // Use the same calculation as the frontend for consistency
    const availableToBudget = await calculateAvailableToBudget(user.id);

    if (totalAmount > availableToBudget) {
        return NextResponse.json({
            error: `Insufficient funds. Need $${totalAmount.toFixed(2)}, have $${availableToBudget.toFixed(2)}`
        }, { status: 400 });
    }

    // Verify all buckets belong to user and are not deleted
    const bucketIds = allocations.map((a: { bucketId: string }) => a.bucketId);
    const buckets = await prisma.bucket.findMany({
        where: { id: { in: bucketIds }, group: { userId: user.id }, isDeleted: false },
    });

    if (buckets.length !== bucketIds.length) {
        return NextResponse.json({ error: 'One or more buckets not found' }, { status: 404 });
    }

    // Create all allocations in a transaction
    const createdAllocations = await prisma.$transaction(
        allocations.map((alloc: { bucketId: string; amount: number; note?: string }) =>
            prisma.budgetAllocation.create({
                data: {
                    userId: user.id,
                    bucketId: alloc.bucketId,
                    amount: alloc.amount,
                    note: alloc.note || null,
                },
            })
        )
    );

    return NextResponse.json({
        success: true,
        count: createdAllocations.length,
        totalAllocated: totalAmount
    });
}
