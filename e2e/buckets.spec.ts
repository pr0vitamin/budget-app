import { test, expect } from '@playwright/test';

test.describe('Buckets Page', () => {
    test('displays buckets page with header', async ({ page }) => {
        await page.goto('/');

        // Should be on buckets page (home)
        await expect(page.getByRole('heading', { name: 'Buckets' })).toBeVisible();
        await expect(page.getByText('Available to Budget')).toBeVisible();
    });

    test('can create a new bucket group', async ({ page }) => {
        await page.goto('/');

        // Click add group button
        await page.getByRole('button', { name: '+ Add Bucket Group' }).click();

        // Fill in group name
        await page.getByPlaceholder('Group name').fill('Test Essentials');

        // Submit
        await page.getByRole('button', { name: 'Create' }).click();

        // Should see the new group
        await expect(page.getByText('Test Essentials')).toBeVisible();
    });

    test('can create a bucket within a group', async ({ page }) => {
        await page.goto('/');

        // First create a group if needed
        const addGroupBtn = page.getByRole('button', { name: '+ Add Bucket Group' });
        if (await addGroupBtn.isVisible()) {
            await addGroupBtn.click();
            await page.getByPlaceholder('Group name').fill('E2E Test Group');
            await page.getByRole('button', { name: 'Create' }).click();
            await expect(page.getByText('E2E Test Group')).toBeVisible();
        }

        // Click add bucket button (the + in the group)
        await page.getByRole('button', { name: 'Add' }).first().click();

        // Fill bucket form
        await page.getByPlaceholder('e.g., Groceries').fill('Test Groceries');

        // Submit
        await page.getByRole('button', { name: 'Create Bucket' }).click();

        // Should see the new bucket
        await expect(page.getByText('Test Groceries')).toBeVisible();
    });

    test('bottom nav shows 4 tabs', async ({ page }) => {
        await page.goto('/');

        // Check all nav items exist
        await expect(page.getByRole('link', { name: 'Buckets' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Inbox' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });
});
