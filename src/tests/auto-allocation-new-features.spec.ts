import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Auto-Allocation New Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');
  });

  test.describe('Sort Order Options', () => {
    test('should preserve input order by default', async ({ page }) => {
      await page.fill('#subnetRequests', 'zulu /27\nalpha /26\nmike /28');
      await page.selectOption('#sortOrder', 'preserve');
      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      const results = await page.locator('#allocation_results').textContent();
      // Extract just the subnet names, avoiding "Allocated Subnets:" prefix
      const matches = [...results.matchAll(/([a-z]+):\s*\d+\.\d+\.\d+\.\d+\/\d+/gi)];
      const order = matches.map(m => m[1]);
      expect(order).toEqual(['zulu', 'alpha', 'mike']);
    });

    test('should sort alphabetically when selected', async ({ page }) => {
      await page.fill('#subnetRequests', 'zulu /27\nalpha /26\nmike /28');
      await page.selectOption('#sortOrder', 'alphabetical');
      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      const results = await page.locator('#allocation_results').textContent();
      // Extract just the subnet names, avoiding "Allocated Subnets:" prefix
      const matches = [...results.matchAll(/([a-z]+):\s*\d+\.\d+\.\d+\.\d+\/\d+/gi)];
      const order = matches.map(m => m[1]);
      expect(order).toEqual(['alpha', 'mike', 'zulu']);
    });

    test('should optimize space usage when selected', async ({ page }) => {
      // Optimal packing puts largest subnets first
      await page.fill('#subnetRequests', 'small /28\nmedium /26\nlarge /24');
      await page.fill('#reserveSpace', ''); // Clear any default padding
      await page.selectOption('#sortOrder', 'optimal');
      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      // With optimal sorting, /24 should be first (largest)
      await expect(page.locator('#allocation_results')).toContainText('large: 10.0.0.0/24');
      await expect(page.locator('#allocation_results')).toContainText('medium: 10.0.1.0/26');
      await expect(page.locator('#allocation_results')).toContainText('small: 10.0.1.64/28');
    });
  });

  test.describe('Alignment Toggle Options', () => {
    test('should align all subnets when checkbox is unchecked', async ({ page }) => {
      await page.fill('#subnetRequests', 'subnet1 /28\nsubnet2 /27\nsubnet3 /26');
      await page.fill('#futureSubnetSize', '/25');
      await page.fill('#reserveSpace', '');

      // Ensure "Only align large" is unchecked (default)
      const checkbox = page.locator('#alignLargeOnly');
      await checkbox.uncheck();

      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      // All subnets should align to /25 boundaries (.0, .128)
      await expect(page.locator('#allocation_results')).toContainText('subnet1: 10.0.0.0/28');
      await expect(page.locator('#allocation_results')).toContainText('subnet2: 10.0.0.128/27');
      await expect(page.locator('#allocation_results')).toContainText('subnet3: 10.0.1.0/26');
    });

    test('should only align large subnets when checkbox is checked', async ({ page }) => {
      await page.fill('#subnetRequests', 'small1 /28\nsmall2 /27\nlarge /25');
      await page.fill('#futureSubnetSize', '/25');
      await page.fill('#reserveSpace', '');

      // Check "Only align large" option
      const checkbox = page.locator('#alignLargeOnly');
      await checkbox.check();

      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      // Small subnets pack naturally, only /25 aligns to /25 boundary
      await expect(page.locator('#allocation_results')).toContainText('small1: 10.0.0.0/28');
      await expect(page.locator('#allocation_results')).toContainText('small2: 10.0.0.32/27'); // Naturally aligned to /27 boundary
      await expect(page.locator('#allocation_results')).toContainText('large: 10.0.0.128/25'); // Aligned to /25 boundary
    });

    test('should handle complex scenario with padding and selective alignment', async ({ page }) => {
      // 4 x /26 subnets with /26 padding and /24 alignment (only for large)
      await page.fill('#subnetRequests', 'subnet1 /26\nsubnet2 /26\nsubnet3 /26\nsubnet4 /26\nlarge /24');
      await page.fill('#reserveSpace', '/26');
      await page.fill('#futureSubnetSize', '/24');
      await page.check('#alignLargeOnly');

      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(500);

      // With alignLargeOnly checked and /24 alignment:
      // - /26 subnets won't force /24 alignment (they're smaller than /24)
      // - But they still have /26 padding between them
      // - The /24 will align to /24 boundary
      await expect(page.locator('#allocation_results')).toContainText('subnet1: 10.0.0.0/26');
      await expect(page.locator('#allocation_results')).toContainText('subnet2: 10.0.0.128/26'); // After /26 padding
      await expect(page.locator('#allocation_results')).toContainText('subnet3: 10.0.1.0/26');   // After /26 padding
      await expect(page.locator('#allocation_results')).toContainText('subnet4: 10.0.1.128/26'); // After /26 padding
      // After subnet4 + /26 padding = 10.0.2.0, which is already /24 aligned
      await expect(page.locator('#allocation_results')).toContainText('large: 10.0.2.0/24');
    });
  });

  test('should combine sorting and alignment features correctly', async ({ page }) => {
    await page.fill('#subnetRequests', 'zebra /27\napple /24\nbanana /26');
    await page.selectOption('#sortOrder', 'optimal'); // Will sort by size (largest first)
    await page.fill('#futureSubnetSize', '/24');
    await page.fill('#reserveSpace', '');
    await page.uncheck('#alignLargeOnly'); // Align all to /24

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(500);

    // With optimal sorting: /24 first, then /26, then /27
    // With /24 alignment: each on a /24 boundary
    await expect(page.locator('#allocation_results')).toContainText('apple: 10.0.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('banana: 10.0.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('zebra: 10.0.2.0/27');
  });
});