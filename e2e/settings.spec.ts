import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
    test('displays settings with user profile', async ({ page }) => {
        await page.goto('/settings');

        // Should show settings header
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

        // Should show profile section
        await expect(page.getByText('Profile')).toBeVisible();
        await expect(page.getByText('e2e-test@bucketbudget.test')).toBeVisible();
    });

    test('displays budget configuration', async ({ page }) => {
        await page.goto('/settings');

        // Should show budget section
        await expect(page.getByText('Budget')).toBeVisible();
        await expect(page.getByText('Budget cycle')).toBeVisible();
        await expect(page.getByText('Start day')).toBeVisible();
    });

    test('can edit budget cycle settings', async ({ page }) => {
        await page.goto('/settings');

        // Click on budget cycle to edit
        await page.getByText('Budget cycle').click();

        // Should see cycle options
        await expect(page.getByRole('button', { name: 'Weekly' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Fortnightly' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Monthly' })).toBeVisible();

        // Click Weekly
        await page.getByRole('button', { name: 'Weekly' }).click();

        // Save
        await page.getByRole('button', { name: 'Save' }).click();

        // Should show updated cycle
        await expect(page.getByText('weekly')).toBeVisible();
    });

    test('shows sign out button', async ({ page }) => {
        await page.goto('/settings');

        // Should have sign out
        await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    });
});
