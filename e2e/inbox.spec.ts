import { test, expect } from '@playwright/test';

test.describe('Inbox Page', () => {
    test('displays inbox with filter tabs', async ({ page }) => {
        await page.goto('/inbox');

        // Should show inbox header
        await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

        // Should show filter tabs
        await expect(page.getByRole('button', { name: /All/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Needs Review/ })).toBeVisible();
    });

    test('can open add transaction form', async ({ page }) => {
        await page.goto('/inbox');

        // Click the + button to add transaction
        await page.getByRole('button').filter({ has: page.locator('svg') }).first().click();

        // Should see transaction form modal
        await expect(page.getByRole('heading', { name: 'Add Transaction' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Expense' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Income' })).toBeVisible();
    });

    test('can add a manual transaction', async ({ page }) => {
        await page.goto('/inbox');

        // Open form
        await page.getByRole('button').filter({ has: page.locator('svg') }).first().click();

        // Fill form
        await page.getByPlaceholder('0.00').fill('42.50');
        await page.getByPlaceholder('e.g., Countdown').fill('Test Supermarket');

        // Submit
        await page.getByRole('button', { name: 'Add Transaction' }).click();

        // Should see the transaction in the list
        await expect(page.getByText('Test Supermarket')).toBeVisible();
        await expect(page.getByText('$42.50')).toBeVisible();
    });
});
