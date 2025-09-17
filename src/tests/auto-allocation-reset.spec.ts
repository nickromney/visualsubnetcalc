import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Auto-Allocation Reset Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should reset network when padding changes and re-allocate', async ({ page }) => {
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
    // Enter subnet requirements
    const subnetRequirements = `AzureFirewallSubnet /26
aks-system /26
aks-ingress /27
AzureBastionSubnet /26
aks-apps /24`;

    await page.fill('#subnetRequests', subnetRequirements);

    // First allocation with /26 padding
    await page.fill('#reserveSpace', '/26');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check first allocation succeeded
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Count subnets with notes - should be 5
    let notedSubnets = await page.locator('input[data-subnet]').evaluateAll(inputs =>
      inputs.filter(input => input.value && input.value.trim() !== '').length
    );
    expect(notedSubnets).toBe(5);

    // Now change padding to /28 and re-allocate
    await page.fill('#reserveSpace', '/28');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check second allocation succeeded
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Count subnets with notes again - should still be 5, not duplicates
    notedSubnets = await page.locator('input[data-subnet]').evaluateAll(inputs =>
      inputs.filter(input => input.value && input.value.trim() !== '').length
    );
    expect(notedSubnets).toBe(5);

    // Verify no duplicates - each subnet name should appear exactly once
    const subnetNotes = await page.locator('input[data-subnet]').evaluateAll(inputs => {
      const notes = {};
      inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
          const name = input.value;
          notes[name] = (notes[name] || 0) + 1;
        }
      });
      return notes;
    });

    // Check each subnet name appears exactly once
    expect(subnetNotes['AzureFirewallSubnet']).toBe(1);
    expect(subnetNotes['aks-system']).toBe(1);
    expect(subnetNotes['aks-ingress']).toBe(1);
    expect(subnetNotes['AzureBastionSubnet']).toBe(1);
    expect(subnetNotes['aks-apps']).toBe(1);

    // Verify the allocations are correct with /28 padding and proper alignment
    await expect(page.locator('#allocation_results')).toContainText('AzureFirewallSubnet: 10.0.0.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.0.128/26'); // After /28 padding, aligned to /26
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.0.224/27'); // After /28 padding, aligned to /27
    await expect(page.locator('#allocation_results')).toContainText('AzureBastionSubnet: 10.0.1.64/26'); // After /28 padding, aligned to /26
    await expect(page.locator('#allocation_results')).toContainText('aks-apps: 10.0.2.0/24'); // After /28 padding, aligned to /24
  });

  test('should start fresh each time auto-allocate is clicked', async ({ page }) => {
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
    // First allocation
    await page.fill('#subnetRequests', 'subnet1 /26\nsubnet2 /27');
    await page.fill('#reserveSpace', '');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Manually split some more subnets
    await page.click('td.split[data-subnet="192.168.0.128/25"]');
    await page.waitForTimeout(100);

    // Now do another allocation with different requirements
    await page.fill('#subnetRequests', 'new-subnet1 /27\nnew-subnet2 /27\nnew-subnet3 /28');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check that we have the new subnets, not the old ones
    const subnetNames = await page.locator('input[data-subnet]').evaluateAll(inputs =>
      inputs
        .filter(input => input.value && input.value.trim() !== '')
        .map(input => input.value)
    );

    expect(subnetNames).toContain('new-subnet1');
    expect(subnetNames).toContain('new-subnet2');
    expect(subnetNames).toContain('new-subnet3');
    expect(subnetNames).not.toContain('subnet1');
    expect(subnetNames).not.toContain('subnet2');
  });

  test('should handle multiple re-allocations without accumulating subnets', async ({ page }) => {
    await page.fill('#network', '10.10.0.0');
    await page.fill('#netsize', '20');
    await page.click('#btn_go');

    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    const requirements = 'test1 /24\ntest2 /25\ntest3 /26';
    await page.fill('#subnetRequests', requirements);

    // Allocate multiple times with different padding
    const paddings = ['', '/28', '/27', '/28', ''];

    for (const padding of paddings) {
      await page.fill('#reserveSpace', padding);
      await page.click('#btn_auto_allocate');
      await page.waitForTimeout(1000);

      // Count allocated subnets - should always be 3
      const count = await page.locator('input[data-subnet]').evaluateAll(inputs =>
        inputs.filter(input => input.value && input.value.trim() !== '').length
      );
      expect(count).toBe(3);

      // Verify no duplicates
      const notes = await page.locator('input[data-subnet]').evaluateAll(inputs =>
        inputs
          .filter(input => input.value && input.value.trim() !== '')
          .map(input => input.value)
      );
      const uniqueNotes = [...new Set(notes)];
      expect(notes.length).toBe(uniqueNotes.length);
    }
  });
});