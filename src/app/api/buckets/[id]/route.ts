import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

async function ownsBucket(userId: string, id: string): Promise<boolean> {
  const bucket = await prisma.bucket.findFirst({
    where: { id, group: { userId } },
    select: { id: true },
  });
  return Boolean(bucket);
}

// GET /api/buckets/:id?limit=&offset= — the cat's activity feed: money fed in
// (BudgetAllocation) and spending/refund allocations (Allocation + Transaction).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownsBucket(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? 50)), 100);
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));

  const [budgetRows, allocRows] = await Promise.all([
    prisma.budgetAllocation.findMany({
      where: { bucketId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.allocation.findMany({
      where: { bucketId: id },
      orderBy: { transaction: { date: 'desc' } },
      take: limit,
      skip: offset,
      include: { transaction: { select: { id: true, merchant: true, description: true, date: true } } },
    }),
  ]);

  return NextResponse.json({
    budgetAllocations: budgetRows.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      note: b.note,
      createdAt: b.createdAt,
    })),
    transactionAllocations: allocRows.map((a) => ({
      id: a.id,
      transactionId: a.transactionId,
      amount: Number(a.amount),
      merchant: a.transaction.merchant ?? a.transaction.description ?? 'Transaction',
      date: a.transaction.date,
    })),
    hasMore: budgetRows.length === limit || allocRows.length === limit,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownsBucket(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const bucket = await prisma.bucket.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      icon: body.icon === undefined ? undefined : body.icon,
      color: body.color ?? undefined,
      targetAmount: body.targetAmount === undefined ? undefined : body.targetAmount,
      topUpAmount: body.topUpAmount === undefined ? undefined : body.topUpAmount,
      groupId: body.groupId ?? undefined,
    },
  });
  return NextResponse.json(bucket);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownsBucket(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Soft delete so historical allocations remain meaningful.
  await prisma.bucket.update({ where: { id }, data: { isArchived: true } });
  return NextResponse.json({ success: true });
}
