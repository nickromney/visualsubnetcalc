import { test, expect } from '@playwright/test';

test.describe('Additional Columns Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');
    });

    test('should toggle additional columns visibility', async ({ page }) => {
        // Set up a network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Check that additional columns are initially hidden
        const ipHeader = await page.locator('#ipHeader');
        const cidrHeader = await page.locator('#cidrHeader');
        const maskHeader = await page.locator('#maskHeader');

        await expect(ipHeader).not.toBeVisible();
        await expect(cidrHeader).not.toBeVisible();
        await expect(maskHeader).not.toBeVisible();

        // Click the toggle button to show additional columns
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check that additional columns are now visible
        await expect(ipHeader).toBeVisible();
        await expect(cidrHeader).toBeVisible();
        await expect(maskHeader).toBeVisible();

        // Check that button text changed
        const buttonText = await page.locator('#toggleColumns').innerText();
        expect(buttonText).toContain('Hide Additional Columns');

        // Check that the data cells are displayed correctly
        const ipCell = await page.locator('.row_ip').first();
        const cidrCell = await page.locator('.row_cidr').first();
        const maskCell = await page.locator('.row_mask').first();

        await expect(ipCell).toBeVisible();
        await expect(ipCell).toHaveText('10.0.0.0');
        await expect(cidrCell).toBeVisible();
        await expect(cidrCell).toHaveText('/24');
        await expect(maskCell).toBeVisible();
        await expect(maskCell).toHaveText('255.255.255.0');

        // Toggle back to hide
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check that additional columns are hidden again
        await expect(ipHeader).not.toBeVisible();
        await expect(cidrHeader).not.toBeVisible();
        await expect(maskHeader).not.toBeVisible();

        // Check that button text changed back
        const buttonTextHidden = await page.locator('#toggleColumns').innerText();
        expect(buttonTextHidden).toContain('Show Additional Columns');
    });

    test('should maintain additional columns state when splitting subnets', async ({ page }) => {
        // Set up a network
        await page.fill('#network', '192.168.1.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Show additional columns
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Split the subnet
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Check that new rows also have the additional columns visible
        const ipCells = await page.locator('.row_ip').all();
        expect(ipCells.length).toBe(2);

        for (const cell of ipCells) {
            await expect(cell).toBeVisible();
        }

        // Check values for the split subnets
        const firstIp = await ipCells[0].innerText();
        const secondIp = await ipCells[1].innerText();
        expect(firstIp).toBe('192.168.1.0');
        expect(secondIp).toBe('192.168.1.128');

        const cidrCells = await page.locator('.row_cidr').all();
        const firstCidr = await cidrCells[0].innerText();
        const secondCidr = await cidrCells[1].innerText();
        expect(firstCidr).toBe('/25');
        expect(secondCidr).toBe('/25');
    });

    test('should show correct masks for different subnet sizes', async ({ page }) => {
        // Set up a network
        await page.fill('#network', '10.10.0.0');
        await page.fill('#netsize', '16');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Show additional columns
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check /16 mask
        let maskCell = await page.locator('.row_mask').first();
        await expect(maskCell).toHaveText('255.255.0.0');

        // Split to /17
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Check /17 masks
        const mask17 = await page.locator('.row_mask').filter({ hasText: '255.255.128.0' });
        await expect(mask17).toHaveCount(2);

        // Split first /17 to /18
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Check /18 mask
        const mask18 = await page.locator('.row_mask').filter({ hasText: '255.255.192.0' });
        await expect(mask18.first()).toBeVisible();
    });
});