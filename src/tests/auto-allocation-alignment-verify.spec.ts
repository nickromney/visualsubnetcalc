import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Alignment Verification', () => {
  test('should verify 4x /26 with /26 padding and /24 alignment', async ({ page }) => {
    await page.goto('/');

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
    // Enter 4 x /26 subnets
    await page.fill('#subnetRequests', 'subnet1 /26\nsubnet2 /26\nsubnet3 /26\nsubnet4 /26');

    // Set padding to /26
    await page.fill('#reserveSpace', '/26');

    // Set alignment to /24
    await page.fill('#futureSubnetSize', '/24');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check the allocations
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Print out the actual allocations for debugging
    const allocations = await page.locator('#allocation_results').textContent();
    console.log('Actual allocations:', allocations);

    // Now let's add a 5th subnet (/24) and see where it goes
    await page.fill('#subnetRequests', 'subnet1 /26\nsubnet2 /26\nsubnet3 /26\nsubnet4 /26\nsubnet5 /24');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    const newAllocations = await page.locator('#allocation_results').textContent();
    console.log('With 5th subnet:', newAllocations);

    // Check where each subnet landed
    await expect(page.locator('#allocation_results')).toContainText('subnet1: 10.0.0.0/26');
    await expect(page.locator('#allocation_results')).toContainText('subnet2: 10.0.1.0/26');
    await expect(page.locator('#allocation_results')).toContainText('subnet3: 10.0.2.0/26');
    await expect(page.locator('#allocation_results')).toContainText('subnet4: 10.0.3.0/26');
    await expect(page.locator('#allocation_results')).toContainText('subnet5: 10.0.4.0/24');
  });
});