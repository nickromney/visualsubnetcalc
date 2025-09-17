import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Auto-Allocation Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display auto-allocation helper section', async ({ page }) => {
    // Check that the auto-allocation helper is visible
    await expect(page.locator('.card-header:has-text("Auto-Allocation Helper")')).toBeVisible();

    // Expand the auto-allocation panel to check its contents
    await page.click('[data-bs-target="#autoAllocationBody"]');
    await page.waitForSelector('#autoAllocationBody.show');

    // Check for input fields
    await expect(page.locator('#reserveSpace')).toBeVisible();
    await expect(page.locator('#futureSubnetSize')).toBeVisible();
    await expect(page.locator('#subnetRequests')).toBeVisible();

    // Check for buttons
    await expect(page.locator('#btn_auto_allocate')).toBeVisible();
    await expect(page.locator('#btn_validate_alignment')).toBeVisible();
  });

  test('should auto-allocate subnets for 10.96.0.0/18 network', async ({ page }) => {
    // Set up the base network
    await page.fill('#network', '10.96.0.0');
    await page.fill('#netsize', '18');
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

    // Enter subnet requirements
    await page.fill('#subnetRequests', 'aks-apps /24\naks-system /26\naks-ingress /27');

    // Clear the reserve space and future subnet size for this test
    await page.fill('#reserveSpace', '');
    await page.fill('#futureSubnetSize', '');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');

    // Wait for allocation to complete
    await page.waitForTimeout(1000);

    // Check that success message appears
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Check that the allocated subnets are displayed in the results
    await expect(page.locator('#allocation_results')).toContainText('aks-apps: 10.96.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.96.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.96.1.64/27');

    // Check that the table has been updated with the allocations
    await expect(page.locator('#calcbody')).toContainText('10.96.0.0/24');
    await expect(page.locator('#calcbody')).toContainText('10.96.1.0/26');
    await expect(page.locator('#calcbody')).toContainText('10.96.1.64/27');

    // Check that notes have been added
    await expect(page.locator('input[data-subnet="10.96.0.0/24"]')).toHaveValue('aks-apps');
    await expect(page.locator('input[data-subnet="10.96.1.0/26"]')).toHaveValue('aks-system');
    await expect(page.locator('input[data-subnet="10.96.1.64/27"]')).toHaveValue('aks-ingress');
  });

  test('should analyze network utilization', async ({ page }) => {
    // Set up the base network
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '16');
    await page.click('#btn_go');

    // Wait for the table to render
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }

    // Click analyze network
    await page.click('#btn_validate_alignment');

    // Check that analysis results appear
    await expect(page.locator('#allocation_results')).toContainText('Network Analysis');
    await expect(page.locator('#allocation_results')).toContainText('Total Subnets');
  });

  test('should handle allocation errors when not enough space', async ({ page }) => {
    // Set up a small network
    await page.fill('#network', '192.168.1.0');
    await page.fill('#netsize', '28');
    await page.click('#btn_go');

    // Wait for the table to render
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }

    // Try to allocate subnets that won't fit
    await page.fill('#subnetRequests', 'subnet1 /24\nsubnet2 /25');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');

    // Wait for allocation to complete
    await page.waitForTimeout(1000);

    // Check that error message appears
    await expect(page.locator('#allocation_results .alert-danger')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('Not enough space');
  });

  test('should add padding between subnets', async ({ page }) => {
    // Set up the base network
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');

    // Wait for the table to render
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }

    // Set padding between subnets
    await page.fill('#reserveSpace', '/28');

    // Enter subnet requirements
    await page.fill('#subnetRequests', 'test1 /26\ntest2 /26');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');

    // Wait for allocation to complete
    await page.waitForTimeout(1000);

    // Check that allocations have padding between them
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('test1: 10.0.0.0/26');
    // With /28 padding after test1, test2 should start at 10.0.0.128/26 (skipping 10.0.0.64-127)
    await expect(page.locator('#allocation_results')).toContainText('test2: 10.0.0.128/26');

    // No padding after the last subnet
  });

  test('should handle invalid subnet alignment example', async ({ page }) => {
    // This tests the specific case mentioned by the user
    // where 10.96.64.80/27 would be an invalid range

    await page.fill('#network', '10.96.0.0');
    await page.fill('#netsize', '18');
    await page.click('#btn_go');

    // Wait for the table to render
    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }

    // The auto-allocation should never create invalid ranges like 10.96.64.80/27
    await page.fill('#subnetRequests', 'test1 /24\ntest2 /27\ntest3 /27');

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check all allocated subnets are properly aligned
    const allocatedSubnets = await page.locator('#allocation_results li').allTextContents();

    for (const subnet of allocatedSubnets) {
      // Extract the IP and size from the allocation text
      const match = subnet.match(/(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
      if (match) {
        const [, ip, size] = match;
        const ipParts = ip.split('.').map(n => parseInt(n));
        const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        const blockSize = Math.pow(2, 32 - parseInt(size));

        // Check that the IP is aligned to its block size
        expect(ipInt % blockSize).toBe(0);
      }
    }
  });
});