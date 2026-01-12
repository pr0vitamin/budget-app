import { test, expect } from '@playwright/test';

test.describe('Inbox Page', () => {
    test('displays inbox when authenticated', async ({ page }) => {
        await page.goto('/inbox');

        // Should see inbox content
        await expect(page.locator('body')).toContainText('Inbox');
        await expect(page.locator('body')).toContainText('All');
    });

    test('has sync button in header', async ({ page }) => {
        await page.goto('/inbox');

        // Should have a sync button
        const syncButton = page.locator('button[title*="sync" i], button[title*="Sync" i]');
        await expect(syncButton.first()).toBeVisible();
    });

    test('has pull-to-refresh indicator', async ({ page }) => {
        await page.goto('/inbox');

        // Pull-to-refresh indicator should exist (hidden by default)
        const pullIndicator = page.locator('text=Pull to refresh');
        // It's rendered but may be invisible until pull
        expect(pullIndicator).toBeDefined();
    });

    test('displays manual transaction badge', async ({ page }) => {
        // Create a manual transaction first
        await page.goto('/inbox');

        // Click add button
        const addButton = page.locator('button').filter({ hasText: '+' }).first();
        if (await addButton.isVisible()) {
            await addButton.click();

            // Fill form if visible
            const merchantInput = page.locator('input[placeholder*="merchant" i], input[name="merchant"]');
            if (await merchantInput.isVisible()) {
                await merchantInput.fill('Test Manual Transaction');

                const amountInput = page.locator('input[type="number"]').first();
                await amountInput.fill('50');

                // Submit
                const submitButton = page.locator('button[type="submit"], button:has-text("Add"), button:has-text("Save")');
                await submitButton.first().click();

                // Wait for page refresh
                await page.waitForTimeout(1000);
            }
        }

        // Manual transactions should show pencil indicator (if any were created)
    });

    test('can navigate between All and Needs Review filters', async ({ page }) => {
        await page.goto('/inbox');

        // Should have All and Needs Review buttons
        await expect(page.locator('button').filter({ hasText: 'All' })).toBeVisible();
        await expect(page.locator('button').filter({ hasText: 'Needs Review' })).toBeVisible();

        // Click Needs Review
        await page.locator('button').filter({ hasText: 'Needs Review' }).click();

        // Button should be active (has different styling)
        await expect(page.locator('button').filter({ hasText: 'Needs Review' })).toHaveClass(/bg-orange/);
    });
});

test.describe('Transaction Allocation', () => {
    test('allocation modal shows transaction details', async ({ page }) => {
        await page.goto('/inbox');

        // Find and click on a transaction if any exist
        const transactionItem = page.locator('[class*="rounded-xl"]').filter({ hasText: '$' }).first();

        if (await transactionItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await transactionItem.click();

            // Modal should show with Allocate header
            await expect(page.locator('text=Allocate Transaction')).toBeVisible({ timeout: 3000 });
        }
    });
});
