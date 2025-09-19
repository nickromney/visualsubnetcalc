import { test, expect } from '@playwright/test';

test.describe('Debug Copy Format', () => {
    test('should examine clipboard content format', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await page.goto('http://localhost:8080');

        // Create a simple network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');

        // Split to create some subnets
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Copy table
        await page.click('#copyTable');
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

        // Log raw content with visible characters
        console.log('=== RAW CLIPBOARD CONTENT ===');
        console.log(clipboardContent);
        console.log('=== END RAW CONTENT ===');

        // Check for tabs and newlines
        const hasTabs = clipboardContent.includes('\t');
        const hasNewlines = clipboardContent.includes('\n');
        const lines = clipboardContent.split('\n');
        const firstLine = lines[0];
        const tabsInFirstLine = (firstLine.match(/\t/g) || []).length;

        console.log(`Has tabs: ${hasTabs}`);
        console.log(`Has newlines: ${hasNewlines}`);
        console.log(`Number of lines: ${lines.length}`);
        console.log(`Tabs in header row: ${tabsInFirstLine}`);
        console.log('First line (header):', firstLine);
        console.log('Second line:', lines[1]);

        // Escape special characters for visibility
        const escaped = clipboardContent
            .replace(/\t/g, '[TAB]')
            .replace(/\n/g, '[NEWLINE]\n')
            .replace(/\r/g, '[CR]');

        console.log('=== ESCAPED VERSION ===');
        console.log(escaped);

        // Verify format
        expect(hasTabs).toBe(true);
        expect(hasNewlines).toBe(true);
        expect(tabsInFirstLine).toBe(8); // Should have 8 tabs for 9 columns
    });
});