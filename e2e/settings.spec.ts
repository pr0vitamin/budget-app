import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
    test('displays settings when authenticated', async ({ page }) => {
        await page.goto('/settings');

        // Should see settings content, not login
        await expect(page.locator('body')).toContainText('Settings');
        await expect(page.locator('body')).toContainText('Account');
    });
});
