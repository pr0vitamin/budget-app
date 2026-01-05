/**
 * E2E test utilities for authentication
 * Uses Supabase test tokens for bypassing magic link flow
 */

import { type Page } from '@playwright/test';

/**
 * Sign in as a test user by setting Supabase session directly
 * This bypasses the magic link flow in tests
 */
export async function signInAsTestUser(page: Page) {
    // For now, we'll navigate to login and use the real flow
    // In the future, we can inject a test session via cookies
    await page.goto('/login');
}

/**
 * Sign out the current user
 */
export async function signOut(page: Page) {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('/login');
}
