import { test, expect } from '@playwright/test';

test.describe('Inbox Page', () => {
    test('displays inbox when authenticated', async ({ page }) => {
        await page.goto('/inbox');

        // Should see inbox content
        await expect(page.locator('body')).toContainText('Inbox');
        await expect(page.locator('body')).toContainText('All');
    });
});
