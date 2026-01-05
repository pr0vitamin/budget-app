import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Playwright global setup - creates an authenticated session for E2E tests
 * Uses Supabase Admin API to create a test user session without going through magic link
 */
async function globalSetup(config: FullConfig) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY for E2E tests');
    }

    if (!databaseUrl) {
        throw new Error('Missing DATABASE_URL for E2E tests');
    }

    // Extract project ref from URL for cookie naming
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const testEmail = 'e2e-test@bucketbudget.test';
    const testPassword = 'e2e-test-password-123';

    // Create or get test user using admin API
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let testUser = existingUsers?.users?.find((u) => u.email === testEmail);

    if (!testUser) {
        const { data, error } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true,
        });

        if (error) {
            throw new Error(`Failed to create test user: ${error.message}`);
        }
        testUser = data.user;
    }

    // Also create user in Prisma database (needed for FK constraints)
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        await prisma.user.upsert({
            where: { id: testUser.id },
            update: { email: testEmail },
            create: {
                id: testUser.id,
                email: testEmail,
            },
        });
        console.log('✅ Test user created in Prisma database');
    } catch (e) {
        console.warn('⚠️ Could not upsert test user in Prisma:', e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }

    // Sign in as test user to get session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
    });

    if (signInError || !signInData.session) {
        throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    // Launch browser and set the auth cookies
    const { baseURL } = config.projects[0].use;
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto('/login');

    // Set Supabase SSR cookie
    const { session } = signInData;
    const cookieName = `sb-${projectRef}-auth-token`;

    const sessionData = JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
    });

    await context.addCookies([
        {
            name: cookieName,
            value: `base64-${Buffer.from(sessionData).toString('base64')}`,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ]);

    await page.goto('/');
    await page.waitForTimeout(1000);

    await context.storageState({ path: './e2e/.auth/user.json' });
    await browser.close();

    console.log('✅ E2E test user authenticated successfully');
}

export default globalSetup;
