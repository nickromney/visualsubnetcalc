import { test, expect } from '@playwright/test';

/**
 * Theme Switcher Tests
 *
 * These tests verify the dark/light theme switching functionality.
 * Tests run against the compiled /dist directory served via HTTP server.
 *
 * Prerequisites:
 * 1. Run `npm run build` to compile source to dist
 * 2. Run `npm start` or `npx http-server dist -p 8080` to serve dist
 * 3. Run tests with `NO_SERVER=1 npm test tests/theme-switcher.spec.ts`
 */
test.describe('Theme Switcher Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Testing against compiled /dist via HTTP server
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');
    });

    test('should default to dark theme', async ({ page }) => {
        // Check that dark theme is set by default
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Check that dark button is active
        const darkButton = await page.locator('#theme_dark');
        await expect(darkButton).toHaveClass(/btn-secondary/);
        await expect(darkButton).not.toHaveClass(/btn-outline-secondary/);

        // Check that light button is inactive
        const lightButton = await page.locator('#theme_light');
        await expect(lightButton).toHaveClass(/btn-outline-secondary/);
        await expect(lightButton).not.toHaveClass('btn-secondary')
    });

    test('should switch to light theme when light button is clicked', async ({ page }) => {
        // Click the light theme button
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Check that light theme is active
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light');

        // Check button states
        const lightButton = await page.locator('#theme_light');
        await expect(lightButton).toHaveClass(/btn-secondary/);
        await expect(lightButton).not.toHaveClass(/btn-outline-secondary/);

        const darkButton = await page.locator('#theme_dark');
        await expect(darkButton).toHaveClass(/btn-outline-secondary/);
        await expect(darkButton).not.toHaveClass('btn-secondary')
    });

    test('should switch back to dark theme when dark button is clicked', async ({ page }) => {
        // First switch to light
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Then switch back to dark
        await page.click('#theme_dark');
        await page.waitForTimeout(500);

        // Check that dark theme is active
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Check button states
        const darkButton = await page.locator('#theme_dark');
        await expect(darkButton).toHaveClass(/btn-secondary/);
        await expect(darkButton).not.toHaveClass(/btn-outline-secondary/);

        const lightButton = await page.locator('#theme_light');
        await expect(lightButton).toHaveClass(/btn-outline-secondary/);
        await expect(lightButton).not.toHaveClass('btn-secondary')
    });

    test('should persist theme choice across page reloads', async ({ page, context }) => {
        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Verify light theme is active
        let htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light');

        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check that light theme persisted
        htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light');

        const lightButton = await page.locator('#theme_light');
        await expect(lightButton).toHaveClass(/btn-secondary/);

        // Clear localStorage and reload to verify default
        await page.evaluate(() => localStorage.removeItem('theme'));
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should be back to dark theme (default)
        htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');
    });

    test('should save theme preference to localStorage', async ({ page }) => {
        // Check initial localStorage (null or 'dark' since default is dark)
        let theme = await page.evaluate(() => localStorage.getItem('theme'));
        expect(theme === null || theme === 'dark').toBeTruthy();

        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Check localStorage updated
        theme = await page.evaluate(() => localStorage.getItem('theme'));
        expect(theme).toBe('light');

        // Switch back to dark
        await page.click('#theme_dark');
        await page.waitForTimeout(500);

        // Check localStorage updated again
        theme = await page.evaluate(() => localStorage.getItem('theme'));
        expect(theme).toBe('dark');
    });

    test('should display theme switcher buttons correctly', async ({ page }) => {
        // Check that both buttons are visible
        const lightButton = await page.locator('#theme_light');
        const darkButton = await page.locator('#theme_dark');

        await expect(lightButton).toBeVisible();
        await expect(darkButton).toBeVisible();

        // Check button text and icons
        await expect(lightButton).toContainText('Light');
        await expect(darkButton).toContainText('Dark');

        // Check for icons
        const lightIcon = await page.locator('#theme_light i.bi-sun-fill');
        const darkIcon = await page.locator('#theme_dark i.bi-moon-stars-fill');

        await expect(lightIcon).toBeVisible();
        await expect(darkIcon).toBeVisible();
    });

    test('should apply dark mode styles correctly', async ({ page }) => {
        // Ensure we're in dark mode
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Check that navigation icons have correct color in dark mode
        const navIcon = await page.locator('#navigation a').first();
        const color = await navIcon.evaluate(el =>
            window.getComputedStyle(el).color
        );

        // Color should be white or rgb(255, 255, 255) in dark mode
        expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|white|#ffffff/i);

        // Switch to light mode
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Check that navigation icons have correct color in light mode
        const lightColor = await navIcon.evaluate(el =>
            window.getComputedStyle(el).color
        );

        // Color should be black or rgb(0, 0, 0) in light mode
        expect(lightColor).toMatch(/rgb\(0,\s*0,\s*0\)|black|#000000/i);
    });

    test('should work with subnet table in both themes', async ({ page }) => {
        // Set up a network to get the table visible
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');

        // Check table is visible in dark mode
        const table = await page.locator('#calc');
        await expect(table).toBeVisible();

        // Switch to light mode
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Check table is still visible and functional
        await expect(table).toBeVisible();

        // Try splitting a subnet in light mode
        await page.locator('td.split').first().click();
        await page.waitForTimeout(500);

        // Check that split worked
        const rows = await page.locator('#calcbody tr').count();
        expect(rows).toBeGreaterThan(1);
    });
});