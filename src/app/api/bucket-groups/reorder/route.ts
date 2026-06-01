import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Body: { order: string[] } — group ids in their new order.
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order } = await request.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 });

  const owned = await prisma.bucketGroup.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((g) => g.id));

  await prisma.$transaction(
    order
      .filter((id: string) => ownedIds.has(id))
      .map((id: string, index: number) =>
        prisma.bucketGroup.update({ where: { id }, data: { sortOrder: index } })
      )
  );
  return NextResponse.json({ success: true });
}
