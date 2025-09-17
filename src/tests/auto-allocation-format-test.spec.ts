import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Subnet Request Format Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    // Expand the Auto-Allocation Helper section
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody.show');
  });

  test('should accept subnet requests with slash notation', async ({ page }) => {
    await page.fill('#subnetRequests', 'aks-apps /24\naks-system /26\naks-ingress /27');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Should allocate successfully
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('aks-apps: 10.0.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.1.64/27');
  });

  test('should accept subnet requests without slash notation', async ({ page }) => {
    await page.fill('#subnetRequests', 'aks-apps 24\naks-system 26\naks-ingress 27');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Should allocate successfully
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('aks-apps: 10.0.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.1.64/27');
  });

  test('should accept mixed format subnet requests', async ({ page }) => {
    await page.fill('#subnetRequests', 'aks-apps /24\naks-system 26\naks-ingress /27');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Should allocate successfully with mixed formats
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('aks-apps: 10.0.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.1.64/27');
  });

  test('should handle edge cases in subnet naming', async ({ page }) => {
    // Test with various subnet name formats
    await page.fill('#subnetRequests', `test-subnet-1 /24
subnet_with_underscore 25
subnet.with.dots /26
UPPERCASE-SUBNET 27
subnet-123-numbers /28`);

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // All should be allocated successfully
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('test-subnet-1');
    await expect(page.locator('#allocation_results')).toContainText('subnet_with_underscore');
    await expect(page.locator('#allocation_results')).toContainText('subnet.with.dots');
    await expect(page.locator('#allocation_results')).toContainText('UPPERCASE-SUBNET');
    await expect(page.locator('#allocation_results')).toContainText('subnet-123-numbers');
  });
});