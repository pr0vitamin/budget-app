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

    // Get or create settings
    let settings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
    });

    if (!settings) {
        settings = await prisma.userSettings.create({
            data: {
                userId: user.id,
                budgetCycleType: 'fortnightly',
                budgetCycleStartDay: 4, // Thursday
            },
        });
    }

    return NextResponse.json({
        budgetCycleType: settings.budgetCycleType,
        budgetCycleStartDay: settings.budgetCycleStartDay,
    });
}

export async function PATCH(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { budgetCycleType, budgetCycleStartDay } = body;

    // Validate inputs
    if (budgetCycleType && !['weekly', 'fortnightly', 'monthly'].includes(budgetCycleType)) {
        return NextResponse.json({ error: 'Invalid budget cycle type' }, { status: 400 });
    }

    if (budgetCycleStartDay !== undefined && (budgetCycleStartDay < 0 || budgetCycleStartDay > 31)) {
        return NextResponse.json({ error: 'Invalid start day' }, { status: 400 });
    }

    const settings = await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
            ...(budgetCycleType && { budgetCycleType }),
            ...(budgetCycleStartDay !== undefined && { budgetCycleStartDay }),
        },
        create: {
            userId: user.id,
            budgetCycleType: budgetCycleType || 'fortnightly',
            budgetCycleStartDay: budgetCycleStartDay ?? 4,
        },
    });

    return NextResponse.json({
        budgetCycleType: settings.budgetCycleType,
        budgetCycleStartDay: settings.budgetCycleStartDay,
    });
}
