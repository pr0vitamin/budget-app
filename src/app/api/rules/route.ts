import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';
import { normalizePattern } from '@/lib/domain/rules';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.categorizationRule.findMany({
    where: { userId },
    include: { bucket: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rules);
}

// Body: { merchantPattern: string; bucketId: string }
export async function POST(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.merchantPattern || !body.bucketId) {
    return NextResponse.json({ error: 'merchantPattern and bucketId required' }, { status: 400 });
  }
  const bucket = await prisma.bucket.findFirst({ where: { id: body.bucketId, group: { userId } } });
  if (!bucket) return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

  const rule = await prisma.categorizationRule.upsert({
    where: { userId_merchantPattern: { userId, merchantPattern: normalizePattern(body.merchantPattern) } },
    update: { bucketId: body.bucketId },
    create: { userId, bucketId: body.bucketId, merchantPattern: normalizePattern(body.merchantPattern) },
  });
  return NextResponse.json(rule, { status: 201 });
}
