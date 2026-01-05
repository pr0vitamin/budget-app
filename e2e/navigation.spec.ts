import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test('can navigate between all pages', async ({ page }) => {
        // Start at home (Buckets)
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Buckets' })).toBeVisible();

        // Go to Inbox
        await page.getByRole('link', { name: 'Inbox' }).click();
        await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

        // Go to Calendar
        await page.getByRole('link', { name: 'Calendar' }).click();
        await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

        // Go to Settings
        await page.getByRole('link', { name: 'Settings' }).click();
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

        // Back to Buckets
        await page.getByRole('link', { name: 'Buckets' }).click();
        await expect(page.getByRole('heading', { name: 'Buckets' })).toBeVisible();
    });
});
