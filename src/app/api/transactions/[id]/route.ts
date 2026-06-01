import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const reclassifying = body.kind && body.kind !== existing.kind;

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      kind: body.kind ?? undefined,
      merchant: body.merchant === undefined ? undefined : body.merchant,
      description: body.description === undefined ? undefined : body.description,
      isReclassified: reclassifying ? true : undefined,
      // Clearing needsReview is an explicit user action.
      needsReview: typeof body.needsReview === 'boolean' ? body.needsReview : undefined,
    },
  });
  return NextResponse.json(transaction);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.source !== 'manual') {
    return NextResponse.json({ error: 'Only manual transactions can be deleted' }, { status: 400 });
  }
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
