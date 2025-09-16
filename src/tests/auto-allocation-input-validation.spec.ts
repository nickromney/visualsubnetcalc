import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Auto-Allocation Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Expand the Auto-Allocation Helper section
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody.show');

    await page.fill('#subnetRequests', 'test /24'); // Always have at least one subnet
  });

  test.describe('Padding field validation', () => {
    test('should accept valid padding values', async ({ page }) => {
      const validInputs = [
        '',           // Empty
        '0',          // Zero
        '/0',         // Zero with slash
        '24',         // Number without slash
        '/24',        // Number with slash
        '9',          // Minimum
        '/32'         // Maximum
      ];

      for (const input of validInputs) {
        await page.fill('#reserveSpace', input);
        await page.click('#btn_auto_allocate');
        await page.waitForTimeout(300);

        // Get the actual result message for debugging
        const resultText = await page.locator('#allocation_results').textContent();

        // Should not show validation error for valid inputs
        // (May show other errors like "Not enough space")
        const hasValidationError = resultText?.includes('Invalid padding size');
        expect(hasValidationError).toBe(false);
      }
    });

    test('should reject invalid padding values', async ({ page }) => {
      const invalidInputs = [
        '400',        // Too large
        'penguins',   // Text
        '/33',        // Out of range
        '0.5',        // Decimal
        '-5',         // Negative
        '1/24',       // Wrong format
        'abc123',     // Mixed
        '5',          // Below minimum (< 9)
        '/8'          // Below minimum (< 9)
      ];

      for (const input of invalidInputs) {
        await page.fill('#reserveSpace', input);
        await page.click('#btn_auto_allocate');
        await page.waitForTimeout(300);

        // Should show error for invalid inputs
        await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
        await expect(page.locator('#allocation_results')).toContainText('Invalid padding size');
      }
    });
  });

  test.describe('Alignment field validation', () => {
    test('should accept valid alignment values', async ({ page }) => {
      const validInputs = [
        '',           // Empty
        '0',          // Zero
        '/0',         // Zero with slash
        '16',         // Number without slash
        '/16',        // Number with slash
        '9',          // Minimum
        '/32'         // Maximum
      ];

      for (const input of validInputs) {
        await page.fill('#futureSubnetSize', input);
        await page.fill('#reserveSpace', ''); // Clear padding to avoid interference
        await page.click('#btn_auto_allocate');
        await page.waitForTimeout(300);

        // Get the actual result message for debugging
        const resultText = await page.locator('#allocation_results').textContent();

        // Should not show validation error for valid inputs
        // (May show other errors like "Not enough space")
        const hasValidationError = resultText?.includes('Invalid alignment size');
        expect(hasValidationError).toBe(false);
      }
    });

    test('should reject invalid alignment values', async ({ page }) => {
      const invalidInputs = [
        '400',        // Too large
        'penguins',   // Text
        '/33',        // Out of range
        '0.5',        // Decimal
        '-5',         // Negative
        '1/24',       // Wrong format
        'abc123',     // Mixed
        '2',          // Below minimum (< 9)
        '/7'          // Below minimum (< 9)
      ];

      for (const input of invalidInputs) {
        await page.fill('#futureSubnetSize', input);
        await page.fill('#reserveSpace', ''); // Clear padding to avoid interference
        await page.click('#btn_auto_allocate');
        await page.waitForTimeout(300);

        // Should show error for invalid inputs
        await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
        await expect(page.locator('#allocation_results')).toContainText('Invalid alignment size');
      }
    });
  });

  test('should handle both fields being invalid', async ({ page }) => {
    await page.fill('#reserveSpace', 'badvalue');
    await page.fill('#futureSubnetSize', 'alsobad');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(300);

    // Should show error (padding error comes first in validation)
    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('Invalid padding size');
  });

  test('should handle edge cases', async ({ page }) => {
    // Test with spaces
    await page.fill('#reserveSpace', ' /24 ');
    await page.fill('#futureSubnetSize', ' 16 ');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(300);

    // Should work with trimmed values
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Test with just slash
    await page.fill('#reserveSpace', '/');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(300);
    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();

    // Test with double slash
    await page.fill('#reserveSpace', '//24');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(300);
    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
  });
});