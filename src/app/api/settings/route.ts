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
                budgetCycleStartDate: new Date(),
            },
        });
    }

    return NextResponse.json({
        budgetCycleType: settings.budgetCycleType,
        budgetCycleStartDate: settings.budgetCycleStartDate.toISOString(),
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
    const { budgetCycleType, budgetCycleStartDate } = body;

    // Validate inputs
    if (budgetCycleType && !['weekly', 'fortnightly', 'monthly'].includes(budgetCycleType)) {
        return NextResponse.json({ error: 'Invalid budget cycle type' }, { status: 400 });
    }

    if (budgetCycleStartDate && isNaN(new Date(budgetCycleStartDate).getTime())) {
        return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }

    const settings = await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
            ...(budgetCycleType && { budgetCycleType }),
            ...(budgetCycleStartDate && { budgetCycleStartDate: new Date(budgetCycleStartDate) }),
        },
        create: {
            userId: user.id,
            budgetCycleType: budgetCycleType || 'fortnightly',
            budgetCycleStartDate: budgetCycleStartDate ? new Date(budgetCycleStartDate) : new Date(),
        },
    });

    return NextResponse.json({
        budgetCycleType: settings.budgetCycleType,
        budgetCycleStartDate: settings.budgetCycleStartDate.toISOString(),
    });
}
