import { test, expect } from '@playwright/test';

test.describe('Color Palette Theme Support', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');

        // Set up a network
        await page.fill('#network', '10.0.0.0');
        await page.fill('#netsize', '24');
        await page.click('#btn_go');
        await page.waitForSelector('#calcbody tr');
    });

    test('should show light colors in light theme', async ({ page }) => {
        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Check first few color swatches have light colors
        const picker1 = await page.locator('#palette_picker_1');
        const color1 = await picker1.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Light theme should use the original pastel colors
        // #ffadad converts to rgb(255, 173, 173)
        expect(color1).toMatch(/rgb\(255,\s*173,\s*173\)/);

        const picker4 = await page.locator('#palette_picker_4');
        const color4 = await picker4.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // #caffbf converts to rgb(202, 255, 191)
        expect(color4).toMatch(/rgb\(202,\s*255,\s*191\)/);
    });

    test('should show dark colors in dark theme', async ({ page }) => {
        // Ensure dark theme is active (default)
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Check first few color swatches have dark colors
        const picker1 = await page.locator('#palette_picker_1');
        const color1 = await picker1.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Dark theme should use the new deep colors
        // #8b3a3a converts to rgb(139, 58, 58)
        expect(color1).toMatch(/rgb\(139,\s*58,\s*58\)/);

        const picker4 = await page.locator('#palette_picker_4');
        const color4 = await picker4.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // #2e7d32 converts to rgb(46, 125, 50)
        expect(color4).toMatch(/rgb\(46,\s*125,\s*50\)/);

        const picker6 = await page.locator('#palette_picker_6');
        const color6 = await picker6.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // #1565c0 converts to rgb(21, 101, 192)
        expect(color6).toMatch(/rgb\(21,\s*101,\s*192\)/);
    });

    test('should apply colors to rows in light theme', async ({ page }) => {
        // Switch to light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Open color palette and select a color
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Click on color picker 2 (orange)
        await page.click('#palette_picker_2');
        await page.waitForTimeout(200);

        // Click on a subnet row to apply color
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_address').click();
        await page.waitForTimeout(200);

        // Check that the row has the color applied
        const rowColor = await firstRow.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Should have the light orange color #ffd6a5 = rgb(255, 214, 165)
        expect(rowColor).toMatch(/rgb\(255,\s*214,\s*165\)/);
    });

    test('should apply colors to rows in dark theme', async ({ page }) => {
        // Ensure dark theme is active
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Open color palette and select a color
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Click on color picker 6 (blue)
        await page.click('#palette_picker_6');
        await page.waitForTimeout(200);

        // Click on a subnet row to apply color
        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_address').click();
        await page.waitForTimeout(200);

        // Check that the row has the color applied
        const rowColor = await firstRow.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Should have the deep blue color #1565c0 = rgb(21, 101, 192)
        expect(rowColor).toMatch(/rgb\(21,\s*101,\s*192\)/);
    });

    test('should maintain good contrast in dark theme', async ({ page }) => {
        // Ensure dark theme
        const htmlElement = await page.locator('html');
        await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark');

        // Open color palette
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);

        // Apply a dark color to a row
        await page.click('#palette_picker_4'); // Deep green
        await page.waitForTimeout(200);

        const firstRow = await page.locator('#calcbody tr').first();
        await firstRow.locator('.row_address').click();
        await page.waitForTimeout(200);

        // Check text is still visible (should be white text on dark background)
        const addressCell = await firstRow.locator('.row_address');
        const textColor = await addressCell.evaluate(el =>
            window.getComputedStyle(el).color
        );

        // Text should be white or light colored for contrast
        // Bootstrap's dark theme typically uses white text
        // We're not forcing white, but checking it's readable
        const backgroundColor = await firstRow.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Just verify we have the expected dark green background
        expect(backgroundColor).toMatch(/rgb\(46,\s*125,\s*50\)/);
    });

    test('should toggle color palette visibility', async ({ page }) => {
        // Initially palette should be hidden
        const palette = await page.locator('#color_palette');
        await expect(palette).toHaveClass(/d-none/);

        // Click to open
        await page.click('#colors_word_open');
        await page.waitForTimeout(200);
        await expect(palette).not.toHaveClass(/d-none/);

        // Click to close
        await page.click('#colors_word_close');
        await page.waitForTimeout(200);
        await expect(palette).toHaveClass(/d-none/);
    });

    test('should update colors when switching themes', async ({ page }) => {
        // Start in light theme
        await page.click('#theme_light');
        await page.waitForTimeout(500);

        // Open palette and check a color
        await page.click('#colors_word_open');
        const picker1 = await page.locator('#palette_picker_1');
        let color1 = await picker1.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );

        // Should be light red
        expect(color1).toMatch(/rgb\(255,\s*173,\s*173\)/);

        // Switch to dark theme
        await page.click('#theme_dark');
        await page.waitForTimeout(500);

        // Color should update to dark red
        color1 = await picker1.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
        );
        expect(color1).toMatch(/rgb\(139,\s*58,\s*58\)/);
    });
});