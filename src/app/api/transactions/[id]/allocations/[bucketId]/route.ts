import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bucketId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, bucketId } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.allocation.deleteMany({ where: { transactionId: id, bucketId } });
  return NextResponse.json({ success: true });
}
