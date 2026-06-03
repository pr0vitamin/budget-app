import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { refreshAccountAndWait } from '@/lib/akahu';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await refreshAccountAndWait(account.akahuId);
  return NextResponse.json(result);
}
