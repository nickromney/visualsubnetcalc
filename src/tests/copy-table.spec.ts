import { test, expect } from '@playwright/test';

test.describe('Copy Table to Clipboard', () => {
    test.beforeEach(async ({ page, context, browserName }) => {
        // Grant clipboard permissions (only works in Chromium)
        if (browserName === 'chromium') {
            await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        }

        await page.goto('http://localhost:8082');
        await page.waitForLoadState('networkidle');
    });

    test('should copy table with parent network row', async ({ page, browserName }) => {
        test.skip(browserName === 'firefox', 'Clipboard API not supported in Firefox tests');
        // Set up a network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Split the subnet to create multiple rows
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Add some notes
        await page.fill('input[data-subnet="10.0.0.0/25"]', 'Production');
        await page.fill('input[data-subnet="10.0.0.128/25"]', 'Development');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Click copy button
        await page.click('#copyTable');
        await page.waitForTimeout(500);

        // Check that button shows success
        const buttonText = await page.locator('#copyTable').innerText();
        expect(buttonText).toContain('Copied');

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        // Verify clipboard content - all columns are always included
        expect(clipboardContent).toContain('Network Address\tIP\tCIDR\tMask\tType\tRange of Addresses\tUsable IPs\tHosts\tNote');
        expect(clipboardContent).toContain('10.0.0.0/24');
        expect(clipboardContent).toContain('Parent Network');
        expect(clipboardContent).not.toContain('---'); // No separator row
        expect(clipboardContent).toContain('10.0.0.0/25');
        expect(clipboardContent).toContain('Production');
        expect(clipboardContent).toContain('10.0.0.128/25');
        expect(clipboardContent).toContain('Development');

        // Wait for button to reset
        await page.waitForTimeout(2500);
        const resetButtonText = await page.locator('#copyTable').innerText();
        expect(resetButtonText).toContain('Copy Table');
    });

    test('should copy table with additional columns when visible', async ({ page, browserName }) => {
        test.skip(browserName === 'firefox', 'Clipboard API not supported in Firefox tests');
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

        // Click copy button
        await page.click('#copyTable');
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        // Verify clipboard content - all columns are always included
        expect(clipboardContent).toContain('Network Address\tIP\tCIDR\tMask\tType\tRange of Addresses\tUsable IPs\tHosts\tNote');
        expect(clipboardContent).toContain('192.168.1.0/24\t192.168.1.0\t/24\t255.255.255.0');
        expect(clipboardContent).toContain('Parent Network');
        expect(clipboardContent).toContain('192.168.1.0/25\t192.168.1.0\t/25\t255.255.255.128');
        expect(clipboardContent).toContain('192.168.1.128/25\t192.168.1.128\t/25\t255.255.255.128');
    });

    test.skip('should not copy when no network is calculated', async ({ page, browserName }) => {
        test.skip(browserName === 'firefox', 'Clipboard API not supported in Firefox tests');

        // Verify the copy button exists
        await expect(page.locator('#copyTable')).toBeVisible();

        // Try to copy without calculating a network
        await page.click('#copyTable');
        await page.waitForTimeout(1000);

        // Button should not show "Copied!" since no network is calculated
        const buttonText = await page.locator('#copyTable').innerText();
        expect(buttonText).not.toContain('Copied');
        expect(buttonText).toContain('Copy Table');
    });

    test('should handle single host networks correctly', async ({ page, browserName }) => {
        test.skip(browserName === 'firefox', 'Clipboard API not supported in Firefox tests');
        // Set up a /32 network
        await page.fill('#network', '10.0.0.1');
        await page.fill('#netsize', '32');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Click copy button
        await page.click('#copyTable');
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        // Verify /32 is handled correctly
        expect(clipboardContent).toContain('10.0.0.1/32');
        expect(clipboardContent).toContain('10.0.0.1\t1\tParent Network');
        expect(clipboardContent).not.toContain('10.0.0.1 - '); // No range for /32
    });

    test('should not duplicate parent network when only one subnet exists', async ({ page, browserName }) => {
        test.skip(browserName === 'firefox', 'Clipboard API not supported in Firefox tests');

        // Set up a network without splitting
        await page.fill('#network', '192.168.100.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForTimeout(500);

        // Add a note to the single subnet
        await page.fill('input[data-subnet="192.168.100.0/24"]', 'Main Network');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Click copy button
        await page.click('#copyTable');
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        // Split content into lines
        const lines = clipboardContent.trim().split('\n');

        // Should only have 2 lines: header and one data row (no duplicate parent)
        expect(lines.length).toBe(2);
        expect(lines[0]).toContain('Network Address\tIP\tCIDR\tMask\tType\tRange of Addresses\tUsable IPs\tHosts\tNote');
        expect(lines[1]).toContain('192.168.100.0/24');
        expect(lines[1]).toContain('Main Network');

        // Should not contain "Parent Network" since the single row has its own note
        expect(clipboardContent).not.toContain('Parent Network');
    });
});