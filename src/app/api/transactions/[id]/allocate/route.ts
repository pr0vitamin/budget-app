import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { validateSplit } from '@/lib/domain/split';

// Body: { allocations: { bucketId: string; amount: number }[] }
// Replaces the transaction's allocations atomically. Allocations must sum to
// the transaction amount (validated here as defense-in-depth; the client also
// enforces it and offers auto-remainder).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const allocations: { bucketId: string; amount: number }[] = body.allocations ?? [];
  if (allocations.length === 0) {
    return NextResponse.json({ error: 'allocations required' }, { status: 400 });
  }

  // All buckets must belong to the user.
  const bucketIds = allocations.map((a) => a.bucketId);
  const ownedCount = await prisma.bucket.count({
    where: { id: { in: bucketIds }, group: { userId } },
  });
  if (ownedCount !== new Set(bucketIds).size) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
  }

  const { valid, remaining } = validateSplit(Number(transaction.amount), allocations);
  if (!valid) {
    return NextResponse.json(
      { error: `Allocations must sum to the transaction amount; remaining ${remaining}` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.allocation.deleteMany({ where: { transactionId: id } }),
    prisma.allocation.createMany({
      data: allocations.map((a) => ({ transactionId: id, bucketId: a.bucketId, amount: a.amount })),
    }),
    // A fresh, balanced allocation clears any prior review flag.
    prisma.transaction.update({ where: { id }, data: { needsReview: false } }),
  ]);

  const updated = await prisma.transaction.findUnique({
    where: { id },
    include: { allocations: { include: { bucket: { select: { id: true, name: true, color: true } } } } },
  });
  return NextResponse.json(updated);
}
