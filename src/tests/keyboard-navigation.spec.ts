import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation in Notes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8082');
        await page.waitForLoadState('networkidle');
    });

    test('should navigate between note fields with arrow keys and Tab', async ({ page }) => {
        // Set up a network and split it
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Split the subnet (click the split cell, not the header)
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Focus on the first note input
        const noteInputs = page.locator('.note input');
        await noteInputs.first().click();
        await noteInputs.first().fill('First note');

        // Press Tab to go to next row
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Check focus moved to second input
        const secondInput = noteInputs.nth(1);
        await expect(secondInput).toBeFocused();

        // Type in second input
        await secondInput.fill('Second note');

        // Press ArrowUp to go back
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);

        // Check focus moved back to first input
        const firstInput = noteInputs.first();
        await expect(firstInput).toBeFocused();

        // Press ArrowDown to go forward
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);

        // Check focus moved to second input again
        await expect(secondInput).toBeFocused();
    });
});