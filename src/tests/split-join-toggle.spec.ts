import { test, expect } from '@playwright/test';

test.describe('Split/Join Toggle Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');

        // Set up a network to have split/join columns visible
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');
    });

    test('should have Hide Split/Join button visible', async ({ page }) => {
        const button = await page.locator('#toggleSplitJoin');
        await expect(button).toBeVisible();
        await expect(button).toContainText('Hide Split/Join');

        // Check for the icon
        const icon = await page.locator('#toggleSplitJoin i.bi-arrows-expand');
        await expect(icon).toBeVisible();
    });

    test('should hide split/join columns when button is clicked', async ({ page }) => {
        // Initially split/join should be visible
        const splitColumn = await page.locator('td.split').first();
        await expect(splitColumn).toBeVisible();

        // Check if join column exists (it's dynamically created)
        const joinColumns = await page.locator('.join').count();
        expect(joinColumns).toBeGreaterThan(0);

        // Click the hide button
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Split/join columns should now be hidden
        await expect(splitColumn).not.toBeVisible();

        // All join elements should be hidden
        const visibleJoins = await page.locator('.join:visible').count();
        expect(visibleJoins).toBe(0);

        // Button text should change
        const button = await page.locator('#toggleSplitJoin');
        await expect(button).toContainText('Show Split/Join');

        // Icon should change
        const icon = await page.locator('#toggleSplitJoin i.bi-arrows-collapse');
        await expect(icon).toBeVisible();
    });

    test('should show split/join columns when toggled back', async ({ page }) => {
        // Hide split/join
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Verify they're hidden
        const splitColumn = await page.locator('td.split').first();
        await expect(splitColumn).not.toBeVisible();

        let visibleJoins = await page.locator('.join:visible').count();
        expect(visibleJoins).toBe(0);

        // Show them again
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Should be visible again
        await expect(splitColumn).toBeVisible();

        visibleJoins = await page.locator('.join:visible').count();
        expect(visibleJoins).toBeGreaterThan(0);

        // Button text should be back to original
        const button = await page.locator('#toggleSplitJoin');
        await expect(button).toContainText('Hide Split/Join');
    });

    test('should hide split/join headers when columns are hidden', async ({ page }) => {
        // Check headers are initially visible
        const splitHeader = await page.locator('#splitHeader');
        const joinHeader = await page.locator('#joinHeader');
        await expect(splitHeader).toBeVisible();
        await expect(joinHeader).toBeVisible();

        // Hide split/join columns
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Headers should be hidden (their parent div)
        const headerParent = await page.locator('#splitHeader').locator('..');
        await expect(headerParent).not.toBeVisible();
    });

    test('should still allow table operations with split/join hidden', async ({ page }) => {
        // Hide split/join columns
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Try to add a note (table should still be functional)
        const noteInput = await page.locator('input[data-subnet]').first();
        await noteInput.fill('Test subnet');

        // Verify the note was added
        await expect(noteInput).toHaveValue('Test subnet');

        // Try toggling additional columns (should still work)
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check that additional columns are shown
        const ipHeader = await page.locator('#ipHeader');
        await expect(ipHeader).toBeVisible();
    });

    test('should work correctly after page operations', async ({ page }) => {
        // Perform some operations first
        // Split a subnet (while split/join is visible)
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Now hide split/join
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // Verify split/join columns are hidden for all rows
        const splitColumns = await page.locator('td.split').all();
        for (const col of splitColumns) {
            await expect(col).not.toBeVisible();
        }

        const joinColumns = await page.locator('td.join.rotate').all();
        for (const col of joinColumns) {
            await expect(col).not.toBeVisible();
        }

        // Show them again
        await page.click('#toggleSplitJoin');
        await page.waitForTimeout(500);

        // All should be visible again
        for (const col of splitColumns) {
            await expect(col).toBeVisible();
        }
    });
});