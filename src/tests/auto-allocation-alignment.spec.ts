import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Auto-Allocation Alignment Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should align subnets to /24 boundaries when specified', async ({ page }) => {
    // Set up the base network
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');

    // Wait for the table to render
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    // Enter subnet requirements - /26 and /25
    await page.fill('#subnetRequests', 'aks-system /26\naks-ingress /25');

    // Set padding to /26
    await page.fill('#reserveSpace', '/26');

    // Set alignment to /24 - this should force subnets to start on /24 boundaries
    await page.fill('#futureSubnetSize', '/24');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');

    // Wait for allocation to complete
    await page.waitForTimeout(1000);

    // Check that success message appears
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // With /24 alignment:
    // - aks-system /26 should be at 10.0.0.0/26 (first /24)
    // - aks-ingress /25 should be at 10.0.1.0/25 (second /24, since padding + alignment forces jump)
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.0.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.1.0/25');

    // Verify in the table
    await expect(page.locator('input[data-subnet="10.0.0.0/26"]')).toHaveValue('aks-system');
    await expect(page.locator('input[data-subnet="10.0.1.0/25"]')).toHaveValue('aks-ingress');
  });

  test('should align to /25 boundaries when specified', async ({ page }) => {
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
    // Three /27 subnets with /25 alignment
    await page.fill('#subnetRequests', 'subnet1 /27\nsubnet2 /27\nsubnet3 /27');
    await page.fill('#reserveSpace', '');
    await page.fill('#futureSubnetSize', '/25');

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // With /25 alignment, each /27 should start on a /25 boundary
    // /25 boundaries are at .0, .128
    await expect(page.locator('#allocation_results')).toContainText('subnet1: 10.0.0.0/27');
    await expect(page.locator('#allocation_results')).toContainText('subnet2: 10.0.0.128/27'); // Next /25 boundary
    await expect(page.locator('#allocation_results')).toContainText('subnet3: 10.0.1.0/27');   // Next /25 boundary
  });

  test('should handle alignment with padding correctly', async ({ page }) => {
    await page.fill('#network', '192.168.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');

    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    // Two /28 subnets with /27 alignment and /29 padding
    await page.fill('#subnetRequests', 'test1 /28\ntest2 /28');
    await page.fill('#reserveSpace', '/29');
    await page.fill('#futureSubnetSize', '/27');

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // With /27 alignment:
    // - test1 /28 at 192.168.0.0/28 (aligned to /27)
    // - After /29 padding (192.168.0.16-23), next /27 boundary is 192.168.0.32
    // - test2 /28 at 192.168.0.32/28
    await expect(page.locator('#allocation_results')).toContainText('test1: 192.168.0.0/28');
    await expect(page.locator('#allocation_results')).toContainText('test2: 192.168.0.32/28');
  });

  test('should ignore alignment when not specified', async ({ page }) => {
    await page.fill('#network', '10.10.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');

    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    // Without alignment, subnets should pack tightly (just natural alignment)
    await page.fill('#subnetRequests', 'subnet1 /27\nsubnet2 /28');
    await page.fill('#reserveSpace', '');
    await page.fill('#futureSubnetSize', ''); // No alignment specified

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Without alignment override, should pack naturally
    await expect(page.locator('#allocation_results')).toContainText('subnet1: 10.10.0.0/27');
    await expect(page.locator('#allocation_results')).toContainText('subnet2: 10.10.0.32/28'); // Right after /27
  });

  test('should handle large alignment sizes', async ({ page }) => {
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
    // Small subnets with /22 alignment (large gaps)
    await page.fill('#subnetRequests', 'tiny1 /28\ntiny2 /28\ntiny3 /28');
    await page.fill('#reserveSpace', '');
    await page.fill('#futureSubnetSize', '/22');

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // With /22 alignment, each subnet starts on a /22 boundary
    // /22 boundaries in 10.0.0.0/16: 10.0.0.0, 10.0.4.0, 10.0.8.0, etc.
    await expect(page.locator('#allocation_results')).toContainText('tiny1: 10.0.0.0/28');
    await expect(page.locator('#allocation_results')).toContainText('tiny2: 10.0.4.0/28');
    await expect(page.locator('#allocation_results')).toContainText('tiny3: 10.0.8.0/28');
  });
});