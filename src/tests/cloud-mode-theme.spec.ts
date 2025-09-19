import { test, expect } from '@playwright/test';

test.describe('Cloud Mode Links Theme Support', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');

        // Set up a network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');
    });

    test('should show cloud mode link with correct colors in dark theme', async ({ page }) => {
        // Ensure dark theme is active
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Switch to Azure mode
        await page.click('button.dropdown-toggle:has-text("Tools")');
        await page.click('#dropdown_azure');
        await page.waitForTimeout(500);

        // Check that Azure link exists
        const azureLink = await page.locator('.cloud-mode-link');
        await expect(azureLink).toBeVisible();
        await expect(azureLink).toHaveText('Azure');

        // Check link color in dark mode (should be white)
        const color = await azureLink.evaluate(el =>
            window.getComputedStyle(el).color
        );
        expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|white|#ffffff/i);

        // Check border color
        const borderColor = await azureLink.evaluate(el =>
            window.getComputedStyle(el).borderBottomColor
        );
        expect(borderColor).toMatch(/rgb\(255,\s*255,\s*255\)|white|#ffffff/i);
    });

    test('should show cloud mode link with correct colors in light theme', async ({ page }) => {
        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Verify light theme is active
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light');

        // Switch to AWS mode
        await page.click('button.dropdown-toggle:has-text("Tools")');
        await page.click('#dropdown_aws');
        await page.waitForTimeout(500);

        // Check that AWS link exists
        const awsLink = await page.locator('.cloud-mode-link');
        await expect(awsLink).toBeVisible();
        await expect(awsLink).toHaveText('AWS');

        // Check link color in light mode (should be black)
        const color = await awsLink.evaluate(el =>
            window.getComputedStyle(el).color
        );
        expect(color).toMatch(/rgb\(0,\s*0,\s*0\)|black|#000000/i);

        // Check border color
        const borderColor = await awsLink.evaluate(el =>
            window.getComputedStyle(el).borderBottomColor
        );
        expect(borderColor).toMatch(/rgb\(0,\s*0,\s*0\)|black|#000000/i);
    });

    test('should maintain correct colors when switching themes', async ({ page }) => {
        // Start in dark theme with OCI mode
        await page.click('button.dropdown-toggle:has-text("Tools")');
        await page.click('#dropdown_oci');
        await page.waitForTimeout(500);

        // Verify initial dark theme colors
        let ociLink = await page.locator('.cloud-mode-link');
        let color = await ociLink.evaluate(el =>
            window.getComputedStyle(el).color
        );
        expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|white|#ffffff/i);

        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Colors should update to light theme
        ociLink = await page.locator('.cloud-mode-link');
        color = await ociLink.evaluate(el =>
            window.getComputedStyle(el).color
        );
        expect(color).toMatch(/rgb\(0,\s*0,\s*0\)|black|#000000/i);

        // Switch back to dark theme
        await page.click('#theme_dark');
        await page.waitForTimeout(500);

        // Colors should return to dark theme
        ociLink = await page.locator('.cloud-mode-link');
        color = await ociLink.evaluate(el =>
            window.getComputedStyle(el).color
        );
        expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|white|#ffffff/i);
    });

    test('should have working tooltips in both themes', async ({ page }) => {
        // Switch to Azure mode
        await page.click('button.dropdown-toggle:has-text("Tools")');
        await page.click('#dropdown_azure');
        await page.waitForTimeout(500);

        // Hover over the Azure link to trigger tooltip
        const azureLink = await page.locator('.cloud-mode-link');
        await azureLink.hover();
        await page.waitForTimeout(500);

        // Check tooltip appears
        const tooltip = await page.locator('.tooltip');
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText('Azure reserves 5 addresses');

        // Switch theme and verify tooltip still works
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        await azureLink.hover();
        await page.waitForTimeout(500);

        await expect(tooltip).toBeVisible();
    });

    test('should maintain proper link styling on hover', async ({ page }) => {
        // Switch to AWS mode
        await page.click('button.dropdown-toggle:has-text("Tools")');
        await page.click('#dropdown_aws');
        await page.waitForTimeout(500);

        const awsLink = await page.locator('.cloud-mode-link');

        // Hover over link
        await awsLink.hover();
        await page.waitForTimeout(200);

        // Check hover styles in dark mode
        const borderStyle = await awsLink.evaluate(el =>
            window.getComputedStyle(el).borderBottomStyle
        );
        expect(borderStyle).toBe('solid');

        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Hover again in light theme
        await awsLink.hover();
        await page.waitForTimeout(200);

        // Check hover styles maintained
        const borderStyleLight = await awsLink.evaluate(el =>
            window.getComputedStyle(el).borderBottomStyle
        );
        expect(borderStyleLight).toBe('solid');
    });
});