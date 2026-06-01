import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return NextResponse.json(settings);
}

// Body: { initialSyncDays?: number; theme?: 'system'|'light'|'dark' }
export async function PATCH(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const initialSyncDays =
    body.initialSyncDays === undefined ? undefined : Math.min(Math.max(1, Number(body.initialSyncDays)), 30);

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: { initialSyncDays, theme: body.theme ?? undefined },
    create: { userId, initialSyncDays: initialSyncDays ?? 30, theme: body.theme ?? 'system' },
  });
  return NextResponse.json(settings);
}
