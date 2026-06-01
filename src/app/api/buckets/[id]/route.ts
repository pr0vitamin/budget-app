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
