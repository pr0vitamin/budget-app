import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.bucketGroup.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    include: { buckets: { where: { isArchived: false }, orderBy: { sortOrder: 'asc' } } },
  });
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const count = await prisma.bucketGroup.count({ where: { userId } });
  const group = await prisma.bucketGroup.create({
    data: { userId, name, sortOrder: count },
  });
  return NextResponse.json(group, { status: 201 });
}
