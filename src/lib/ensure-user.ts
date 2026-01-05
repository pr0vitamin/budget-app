import { prisma } from '@/lib/db';

/**
 * Ensure a Supabase auth user exists in the Prisma database.
 * This syncs the auth user with our User table on first access.
 */
export async function ensureUserExists(user: { id: string; email?: string | null }) {
    await prisma.user.upsert({
        where: { id: user.id },
        update: { lastActiveAt: new Date() },
        create: { id: user.id, email: user.email || '' },
    });
}
