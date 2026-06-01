import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { groupId, name } = body;
  if (!groupId || !name) {
    return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 });
  }
  const group = await prisma.bucketGroup.findFirst({ where: { id: groupId, userId } });
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const count = await prisma.bucket.count({ where: { groupId } });
  const bucket = await prisma.bucket.create({
    data: {
      groupId,
      name,
      icon: body.icon ?? null,
      color: body.color ?? undefined,
      targetAmount: body.targetAmount ?? null,
      topUpAmount: body.topUpAmount ?? 0,
      sortOrder: count,
    },
  });
  return NextResponse.json(bucket, { status: 201 });
}
