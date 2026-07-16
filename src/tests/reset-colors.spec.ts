import { test, expect } from '@playwright/test';

async function getInlineBackgroundColor(row) {
    return row.evaluate(el => el.style.backgroundColor);
}

test.describe('Reset Colors Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Set up a network with multiple subnets
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');

        // Split to create multiple subnets
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);
    });

    test('should show Reset button in color palette', async ({ page }) => {
        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Check Reset button is visible
        const resetButton = await page.locator('#reset_colors');
        await expect(resetButton).toBeVisible();
        await expect(resetButton).toContainText('Reset');
    });

    test('should reset all row colors when clicked', async ({ page }) => {
        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Apply colors to multiple rows
        // First row - red
        await page.click('#palette_picker_1');
        await page.waitForTimeout(200);
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Second row - blue
        await page.click('#palette_picker_6');
        await page.waitForTimeout(200);
        const secondRow = await page.locator('#calcbody tr').nth(1);
        await secondRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Verify colors are applied
        let firstRowColor = await getInlineBackgroundColor(firstRow);
        let secondRowColor = await getInlineBackgroundColor(secondRow);

        expect(firstRowColor).not.toBe('');
        expect(secondRowColor).not.toBe('');

        // Click Reset button
        await page.click('#reset_colors');
        await page.waitForTimeout(500);

        // Check colors are removed
        firstRowColor = await getInlineBackgroundColor(firstRow);
        secondRowColor = await getInlineBackgroundColor(secondRow);

        expect(firstRowColor).toBe('');
        expect(secondRowColor).toBe('');
    });

    test('should show feedback when reset is clicked', async ({ page }) => {
        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Apply a color to a row
        await page.click('#palette_picker_3');
        await page.waitForTimeout(200);
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Click Reset and check feedback
        const resetButton = await page.locator('#reset_colors');
        await resetButton.click();

        // Should show "Reset!" temporarily
        await expect(resetButton).toContainText('Reset!');

        // Wait for it to revert
        await page.waitForTimeout(1200);
        await expect(resetButton).toContainText('Reset');
    });

    test('should work in both light and dark themes', async ({ page }) => {
        // Test in dark theme (default)
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Apply a dark theme color
        await page.click('#palette_picker_4'); // Deep green in dark mode
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Reset
        await page.click('#reset_colors');
        await page.waitForTimeout(500);

        // Verify reset worked
        let rowColor = await getInlineBackgroundColor(firstRow);
        expect(rowColor).toBe('');

        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Apply a light theme color
        await page.click('#palette_picker_5'); // Light cyan
        await firstRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Verify color applied
        rowColor = await getInlineBackgroundColor(firstRow);
        expect(rowColor).not.toBe('');

        // Reset again
        await page.click('#reset_colors');
        await page.waitForTimeout(500);

        // Verify reset worked in light theme
        rowColor = await getInlineBackgroundColor(firstRow);
        expect(rowColor).toBe('');
    });

    test('should persist reset through page actions', async ({ page }) => {
        // Apply some colors first
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        await page.click('#palette_picker_2');
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_address').click();
        await page.waitForTimeout(200);

        await page.click('#palette_picker_5');
        const secondRow = await page.locator('#calcbody tr').nth(1);
        await secondRow.locator('.row_hosts').click();
        await page.waitForTimeout(200);

        // Verify colors are applied
        let color1 = await getInlineBackgroundColor(firstRow);
        let color2 = await getInlineBackgroundColor(secondRow);

        expect(color1).not.toBe('');
        expect(color2).not.toBe('');

        // Reset colors
        await page.click('#reset_colors');
        await page.waitForTimeout(500);

        // Colors should be cleared
        color1 = await getInlineBackgroundColor(firstRow);
        color2 = await getInlineBackgroundColor(secondRow);

        expect(color1).toBe('');
        expect(color2).toBe('');

        // Do another action (split a subnet if possible) to verify colors stay cleared
        const splitCount = await page.locator('td.split').count();
        if (splitCount > 2) {
            await page.locator('td.split').nth(2).click();
            await page.waitForTimeout(500);

            // Original rows should still have no color
            color1 = await getInlineBackgroundColor(firstRow);
            expect(color1).toBe('');
        }
    });

    test('should reset colors from deeply nested subnets', async ({ page }) => {
        // Create deeper nesting by splitting more
        await page.locator('td.split').nth(1).click();
        await page.waitForTimeout(500);
        await page.locator('td.split').nth(2).click();
        await page.waitForTimeout(500);

        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Color multiple nested subnets
        const rowCount = await page.locator('#calcbody tr').count();
        const indicesToColor = [0, 1, 2].filter(i => i < rowCount); // Color first few rows that exist

        for (let i of indicesToColor) {
            await page.click(`#palette_picker_${(i % 8) + 1}`);
            await page.waitForTimeout(100);
            const row = await page.locator('#calcbody tr').nth(i);
            await row.locator('.row_hosts').click();
            await page.waitForTimeout(100);
        }

        // Verify colors are applied
        for (let i of indicesToColor) {
            const row = await page.locator('#calcbody tr').nth(i);
            const color = await getInlineBackgroundColor(row);
            expect(color).not.toBe('');
        }

        // Reset all colors
        await page.click('#reset_colors');
        await page.waitForTimeout(500);

        // Verify all colors are removed
        const totalRows = await page.locator('#calcbody tr').count();
        for (let i = 0; i < totalRows; i++) {
            const row = await page.locator('#calcbody tr').nth(i);
            const color = await getInlineBackgroundColor(row);
            expect(color).toBe('');
        }
    });
});