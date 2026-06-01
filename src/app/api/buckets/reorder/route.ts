import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Body: { order: string[] } — bucket ids in their new order (within/across groups).
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order } = await request.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 });

  const owned = await prisma.bucket.findMany({ where: { group: { userId } }, select: { id: true } });
  const ownedIds = new Set(owned.map((b) => b.id));

  await prisma.$transaction(
    order
      .filter((id: string) => ownedIds.has(id))
      .map((id: string, index: number) =>
        prisma.bucket.update({ where: { id }, data: { sortOrder: index } })
      )
  );
  return NextResponse.json({ success: true });
}
