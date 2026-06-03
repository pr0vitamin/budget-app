import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

// Deleting an account NEVER deletes transactions — the schema's onDelete:
// SetNull keeps the durable ledger intact (the income-loss fix).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.account.delete({ where: { id } }); // transactions.accountId → null (SetNull)
  return NextResponse.json({ success: true });
}
