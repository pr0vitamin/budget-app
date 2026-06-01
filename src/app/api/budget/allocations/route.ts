import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { calculateAvailableToBudget } from '@/lib/domain/balances';

async function availableFor(userId: string): Promise<number> {
  const [income, feeds] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, kind: 'income' }, _sum: { amount: true } }),
    prisma.budgetAllocation.aggregate({ where: { userId }, _sum: { amount: true } }),
  ]);
  return calculateAvailableToBudget({
    incomeTotal: Number(income._sum.amount ?? 0),
    feedsTotal: Number(feeds._sum.amount ?? 0),
  });
}

// Body: { bucketId: string; amount: number; note?: string }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const amount = Number(body.amount);
  if (!body.bucketId || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'bucketId and positive amount required' }, { status: 400 });
  }
  const bucket = await prisma.bucket.findFirst({ where: { id: body.bucketId, group: { userId } } });
  if (!bucket) return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

  const available = await availableFor(userId);
  if (amount > available + 0.001) {
    return NextResponse.json({ error: 'Insufficient available to budget' }, { status: 400 });
  }

  const feed = await prisma.budgetAllocation.create({
    data: { userId, bucketId: body.bucketId, amount, note: body.note ?? null },
  });
  return NextResponse.json(feed, { status: 201 });
}
