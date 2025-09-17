import { test, expect } from '@playwright/test';

test.describe('RFC Address Detection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8082');
        await page.waitForLoadState('networkidle');
    });

    test('should identify RFC1918 private addresses in Type column', async ({ page }) => {
        // Test 10.0.0.0/8 range
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Show additional columns to see Type
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check for RFC1918 in Type column
        let row = page.locator('#calcbody tr').first();
        const typeText = await row.locator('.row_type').innerText();
        expect(typeText).toBe('RFC1918');

        // Check for bold text styling
        await expect(row).toHaveClass(/rfc1918-row/);
        const fontWeight = await row.locator('.row_address').evaluate(el => window.getComputedStyle(el).fontWeight);
        expect(['700', 'bold']).toContain(fontWeight);

        // Test 172.16.0.0/12 range
        await page.fill('#network', '172.20.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        row = page.locator('#calcbody tr').first();
        const type2 = await row.locator('.row_type').innerText();
        expect(type2).toBe('RFC1918');

        // Test 192.168.0.0/16 range
        await page.fill('#network', '192.168.1.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        row = page.locator('#calcbody tr').first();
        const type3 = await row.locator('.row_type').innerText();
        expect(type3).toBe('RFC1918');
    });

    test('should identify RFC6598 shared addresses in Type column', async ({ page }) => {
        // Test 100.64.0.0/10 range
        await page.fill('#network', '100.64.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Show additional columns to see Type
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check for RFC6598 in Type column
        let row = page.locator('#calcbody tr').first();
        const typeText = await row.locator('.row_type').innerText();
        expect(typeText).toBe('RFC6598');

        // Check for underline styling
        await expect(row).toHaveClass(/rfc6598-row/);
        const textDecoration = await row.locator('.row_address').evaluate(el => window.getComputedStyle(el).textDecoration);
        expect(textDecoration).toContain('underline');

        // Test another address in the range
        await page.fill('#network', '100.127.255.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        row = page.locator('#calcbody tr').first();
        const type2 = await row.locator('.row_type').innerText();
        expect(type2).toBe('RFC6598');
    });

    test('should show Public for non-RFC addresses', async ({ page }) => {
        // Test public address
        await page.fill('#network', '8.8.8.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Show additional columns to see Type
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Check for Public in Type column
        let row = page.locator('#calcbody tr').first();
        const typeText = await row.locator('.row_type').innerText();
        expect(typeText).toBe('Public');

        // Should not have RFC classes
        await expect(row).not.toHaveClass(/rfc1918-row/);
        await expect(row).not.toHaveClass(/rfc6598-row/);
    });

    test('should show Type column with additional columns', async ({ page }) => {
        // Set up a network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Initially Type column should be hidden
        const typeHeader = page.locator('#typeHeader');
        await expect(typeHeader).not.toBeVisible();

        // Show additional columns
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Type column should now be visible
        await expect(typeHeader).toBeVisible();
        await expect(typeHeader).toHaveText('Type');
    });

    test('should maintain RFC styling when splitting subnets', async ({ page }) => {
        // Start with RFC1918 address
        await page.fill('#network', '10.10.10.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Split the subnet
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Show additional columns to see Type
        await page.click('#toggleColumns');
        await page.waitForTimeout(500);

        // Both new subnets should show RFC1918 type
        const rows = await page.locator('#calcbody tr').all();
        expect(rows.length).toBe(2);

        for (const row of rows) {
            const typeText = await row.locator('.row_type').innerText();
            expect(typeText).toBe('RFC1918');
        }
    });
});