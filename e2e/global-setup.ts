import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Playwright global setup - creates an authenticated session for E2E tests
 * Uses Supabase Admin API to create a test user session without going through magic link
 */
async function globalSetup(config: FullConfig) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY for E2E tests');
    }

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
        // Create test user
        const { data, error } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true, // Auto-confirm email
        });

        if (error) {
            throw new Error(`Failed to create test user: ${error.message}`);
        }
        testUser = data.user;
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

    // Navigate to the app to initialize cookies
    await page.goto('/login');

    // Set Supabase auth cookies
    const { session } = signInData;
    await context.addCookies([
        {
            name: 'sb-access-token',
            value: session.access_token,
            domain: new URL(baseURL!).hostname,
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
        },
        {
            name: 'sb-refresh-token',
            value: session.refresh_token,
            domain: new URL(baseURL!).hostname,
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
        },
    ]);

    // Save the storage state
    await context.storageState({ path: './e2e/.auth/user.json' });

    await browser.close();

    console.log('✅ E2E test user authenticated successfully');
}

export default globalSetup;
