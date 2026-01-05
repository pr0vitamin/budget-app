import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Skip auth for now - this will redirect to login
        // In M6/M7, we'll add proper auth bypass
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL('/login');
    });

    test('login page shows magic link form', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
        await expect(page.getByLabel('Email address')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Send Magic Link' })).toBeVisible();
    });
});
