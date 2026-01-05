import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test('authenticated user can view all pages', async ({ page }) => {
        // Buckets page
        await page.goto('/');
        await expect(page.locator('body')).toContainText('Buckets');
        await expect(page.locator('body')).not.toContainText('Welcome back'); // Not login page

        // Inbox page
        await page.goto('/inbox');
        await expect(page.locator('body')).toContainText('Inbox');

        // Calendar page
        await page.goto('/calendar');
        await expect(page.locator('body')).toContainText('Calendar');

        // Settings page
        await page.goto('/settings');
        await expect(page.locator('body')).toContainText('Settings');
    });
});
