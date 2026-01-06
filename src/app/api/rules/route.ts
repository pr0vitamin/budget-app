import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.categorizationRule.findMany({
        where: { userId: user.id },
        include: {
            bucket: { select: { id: true, name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rules);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { merchantPattern, bucketId } = body;

    if (!merchantPattern || typeof merchantPattern !== 'string') {
        return NextResponse.json({ error: 'Merchant pattern is required' }, { status: 400 });
    }

    if (!bucketId || typeof bucketId !== 'string') {
        return NextResponse.json({ error: 'Bucket ID is required' }, { status: 400 });
    }

    // Verify bucket belongs to user
    const bucket = await prisma.bucket.findUnique({
        where: { id: bucketId },
        include: { group: { select: { userId: true } } },
    });

    if (!bucket) {
        return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    if (bucket.group.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create rule (upsert to handle duplicates)
    const rule = await prisma.categorizationRule.upsert({
        where: {
            userId_merchantPattern: {
                userId: user.id,
                merchantPattern: merchantPattern.toLowerCase().trim(),
            },
        },
        update: { bucketId },
        create: {
            userId: user.id,
            merchantPattern: merchantPattern.toLowerCase().trim(),
            bucketId,
        },
        include: {
            bucket: { select: { id: true, name: true, color: true } },
        },
    });

    return NextResponse.json(rule, { status: 201 });
}
