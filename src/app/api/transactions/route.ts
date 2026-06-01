import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { classifyKind } from '@/lib/domain/classify';

// GET /api/transactions?status=&kind=&unallocated=true
export async function GET(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const kind = searchParams.get('kind');
  const unallocated = searchParams.get('unallocated') === 'true';

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
      ...(unallocated ? { allocations: { none: {} } } : {}),
    },
    orderBy: { date: 'desc' },
    include: { allocations: { include: { bucket: { select: { id: true, name: true, color: true } } } } },
  });
  return NextResponse.json(transactions);
}

// POST — manual transaction entry. Body: { amount, date, merchant?, description?, kind? }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const amount = Number(body.amount);
  if (Number.isNaN(amount) || !body.date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 });
  }
  const kind = body.kind ?? classifyKind({ amount });

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      source: 'manual',
      amount,
      date: new Date(body.date),
      merchant: body.merchant ?? null,
      description: body.description ?? null,
      kind,
      status: 'confirmed',
    },
  });
  return NextResponse.json(transaction, { status: 201 });
}
