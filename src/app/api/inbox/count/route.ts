import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Only expenses need allocating; income and transfers are excluded.
export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const count = await prisma.transaction.count({
    where: { userId, kind: 'expense', allocations: { none: {} } },
  });
  return NextResponse.json({ count });
}
