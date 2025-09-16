import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Subnet Requirements Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Expand the Auto-Allocation Helper section
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody.show');
  });

  test('should show in-context error for invalid subnet sizes', async ({ page }) => {
    // Test subnet size > 32
    await page.fill('#subnetRequests', 'AzureBastionSubnet 33');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(500);

    // Should show error in allocation_results with subnet name, NOT a modal
    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('AzureBastionSubnet: Invalid subnet size /33 (must be /9 to /32)');

    // Test multiple invalid sizes
    await page.fill('#subnetRequests', 'subnet1 /24\nsubnet2 /5\nsubnet3 /40\nsubnet4 /25');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(500);

    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('subnet2: Invalid subnet size /5 (must be /9 to /32)');
    await expect(page.locator('#allocation_results')).toContainText('subnet3: Invalid subnet size /40 (must be /9 to /32)');

    // Should not show error for valid subnets
    await expect(page.locator('#allocation_results')).not.toContainText('subnet1:');
    await expect(page.locator('#allocation_results')).not.toContainText('subnet4:');
  });

  test('should show error for invalid subnet request format', async ({ page }) => {
    await page.fill('#subnetRequests', 'aks-apps\njust-a-name\nvalid /24\n/24 without name');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(500);

    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('Line 1: Invalid format "aks-apps"');
    await expect(page.locator('#allocation_results')).toContainText('Line 2: Invalid format "just-a-name"');
    await expect(page.locator('#allocation_results')).toContainText('Line 4: Invalid format "/24 without name"');

    // Should not show error for valid line
    await expect(page.locator('#allocation_results')).not.toContainText('Line 3');
  });

  test('should validate successfully when all subnet sizes are valid', async ({ page }) => {
    await page.fill('#subnetRequests', 'subnet-one /24\nsubnet-two 25\nsubnet-three /32\nsubnet-four /9');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(500);

    // Should not show validation errors about invalid sizes or formats
    const resultText = await page.locator('#allocation_results').textContent();
    expect(resultText).not.toContain('Invalid subnet size');
    expect(resultText).not.toContain('Invalid format');

    // Should show either success or other non-validation errors
    const hasSuccess = await page.locator('#allocation_results .alert-success').count();
    const hasDanger = await page.locator('#allocation_results .alert-danger').count();
    expect(hasSuccess + hasDanger).toBeGreaterThan(0);
  });

  test('Auto-Allocation Helper should be collapsed by default', async ({ page }) => {
    // Reload page to check default state
    await page.reload();

    // The collapsible body should not have the 'show' class
    await expect(page.locator('#autoAllocationBody')).not.toHaveClass(/show/);

    // The chevron should be pointing right (collapsed state)
    await expect(page.locator('[data-bs-target="#autoAllocationBody"] i')).toHaveClass(/bi-chevron-right/);
  });

  test('clicking header should expand/collapse Auto-Allocation Helper', async ({ page }) => {
    // Reload to start fresh
    await page.reload();

    // Initially collapsed
    await expect(page.locator('#autoAllocationBody')).not.toHaveClass(/show/);

    // Click to expand
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody.show');
    await expect(page.locator('[data-bs-target="#autoAllocationBody"] i')).toHaveClass(/bi-chevron-down/);

    // Click to collapse
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody:not(.show)');
    await expect(page.locator('[data-bs-target="#autoAllocationBody"] i')).toHaveClass(/bi-chevron-right/);
  });
});