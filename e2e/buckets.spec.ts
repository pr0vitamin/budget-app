import { test, expect } from '@playwright/test';

test.describe('Cats Page', () => {
    test('displays cats page when authenticated', async ({ page }) => {
        await page.goto('/');

        // Should not be redirected to login - should see buckets content
        await expect(page.locator('body')).toContainText('Cats');
        await expect(page.locator('body')).toContainText('Available to Budget');
    });

    test('bottom nav is visible', async ({ page }) => {
        await page.goto('/');

        // Bottom nav should be present with links
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
        await expect(nav.getByText('Cats')).toBeVisible();
        await expect(nav.getByText('Inbox')).toBeVisible();
    });
});
