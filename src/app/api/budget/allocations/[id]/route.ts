import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/budget/allocations/:id
 * Update a budget allocation amount
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, note } = body;

    // Get existing allocation and verify ownership
    const existing = await prisma.budgetAllocation.findUnique({
        where: { id },
    });

    if (!existing || existing.userId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Calculate available if increasing amount
    if (amount && amount > Number(existing.amount)) {
        const incomeResult = await prisma.transaction.aggregate({
            where: { account: { userId: user.id }, amount: { gt: 0 } },
            _sum: { amount: true },
        });
        const allocationsResult = await prisma.budgetAllocation.aggregate({
            where: { userId: user.id },
            _sum: { amount: true },
        });
        const availableToBudget = Number(incomeResult._sum.amount || 0) - Number(allocationsResult._sum.amount || 0);
        const additionalNeeded = amount - Number(existing.amount);

        if (additionalNeeded > availableToBudget) {
            return NextResponse.json({ error: 'Insufficient funds available to budget' }, { status: 400 });
        }
    }

    const updated = await prisma.budgetAllocation.update({
        where: { id },
        data: {
            ...(amount !== undefined && { amount }),
            ...(note !== undefined && { note }),
        },
    });

    return NextResponse.json({
        id: updated.id,
        amount: Number(updated.amount),
        note: updated.note,
    });
}

/**
 * DELETE /api/budget/allocations/:id
 * Delete a budget allocation (returns money to pool)
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.budgetAllocation.findUnique({
        where: { id },
    });

    if (!existing || existing.userId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.budgetAllocation.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}
