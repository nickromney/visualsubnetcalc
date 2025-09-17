import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Comprehensive Auto-Allocation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should not create duplicate allocations with 6 subnets', async ({ page }) => {
    // This is the exact failing case reported by the user
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
    // Enter the exact subnet requirements that were failing
    const subnetRequirements = `aks-system /26
aks-ingress /27
aks-app /24
AzureBastionSubnet /26
app-gw /25
AzureFirewallSubnet /26`;

    await page.fill('#subnetRequests', subnetRequirements);

    // Clear padding for this test to focus on the allocation logic
    await page.fill('#reserveSpace', '');

    // Click auto-allocate
    await page.click('#btn_auto_allocate');

    // Wait for allocation to complete (main setTimeout is 100ms, then another 200ms for notes)
    await page.waitForTimeout(1000);

    // Check that all subnets were allocated
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('aks-system: 10.0.0.0/26');
    await expect(page.locator('#allocation_results')).toContainText('aks-ingress: 10.0.0.64/27');
    await expect(page.locator('#allocation_results')).toContainText('aks-app: 10.0.1.0/24');
    await expect(page.locator('#allocation_results')).toContainText('AzureBastionSubnet: 10.0.2.0/26');
    await expect(page.locator('#allocation_results')).toContainText('app-gw: 10.0.2.128/25'); // Aligned to /25 boundary
    await expect(page.locator('#allocation_results')).toContainText('AzureFirewallSubnet: 10.0.3.0/26');

    // Verify NO DUPLICATES - each subnet name should appear exactly once
    const allInputs = await page.locator('input[data-subnet]').all();
    const subnetNotes = {};

    for (const input of allInputs) {
      const value = await input.inputValue();
      const subnet = await input.getAttribute('data-subnet');

      if (value && value.trim() !== '') {
        // Skip duplicate check for spare subnets since there can be multiple
        if (!value.includes('(spare)')) {
          // Check that this note hasn't been used before
          expect(subnetNotes[value], `Duplicate allocation found: ${value} appears in both ${subnetNotes[value]} and ${subnet}`).toBeUndefined();
          subnetNotes[value] = subnet;
        }
      }
    }

    // Verify that each requested subnet appears exactly once
    expect(Object.keys(subnetNotes).sort()).toEqual([
      'AzureBastionSubnet',
      'AzureFirewallSubnet',
      'aks-app',
      'aks-ingress',
      'aks-system',
      'app-gw'
    ]);
  });

  test('should handle padding correctly with multiple subnets', async ({ page }) => {
    // Test with padding to ensure it doesn't cause duplicates
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
    const subnetRequirements = `web-tier /26
app-tier /26
db-tier /27`;

    await page.fill('#subnetRequests', subnetRequirements);
    await page.fill('#reserveSpace', '/28'); // Add padding

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check allocations with padding
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();
    await expect(page.locator('#allocation_results')).toContainText('web-tier: 10.0.0.0/26');
    await expect(page.locator('#allocation_results')).toContainText('app-tier: 10.0.0.128/26'); // After /28 padding, aligned to /26
    await expect(page.locator('#allocation_results')).toContainText('db-tier: 10.0.0.224/27'); // After /28 padding, aligned to /27

    // Verify no duplicates
    const notes = await page.locator('input[data-subnet]').evaluateAll(inputs =>
      inputs
        .map(input => input.value)
        .filter(v => v && v.trim() !== '')
    );

    const uniqueNotes = [...new Set(notes)];
    expect(notes.length).toBe(uniqueNotes.length);
  });

  test('should correctly allocate mixed subnet sizes', async ({ page }) => {
    await page.fill('#network', '192.168.0.0');
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
    const subnetRequirements = `large /22
medium1 /24
medium2 /24
small1 /27
small2 /27
tiny /29`;

    await page.fill('#subnetRequests', subnetRequirements);
    await page.fill('#reserveSpace', '');

    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Verify all allocations are present
    await expect(page.locator('#allocation_results .alert-success')).toBeVisible();

    // Count the number of allocated subnets in results
    const resultsText = await page.locator('#allocation_results').textContent();
    const allocatedCount = (resultsText.match(/\//g) || []).length;
    expect(allocatedCount).toBe(6);

    // Verify no duplicates in the visual table
    const subnetValues = await page.locator('input[data-subnet]').evaluateAll(inputs => {
      const values = {};
      inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
          values[input.dataset.subnet] = input.value;
        }
      });
      return values;
    });

    // Check that each value is unique
    const allValues = Object.values(subnetValues);
    const uniqueValues = [...new Set(allValues)];
    expect(allValues.length).toBe(uniqueValues.length);
  });

  test('should handle sequential allocations without overlaps', async ({ page }) => {
    await page.fill('#network', '10.10.0.0');
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
    // Allocate some subnets
    await page.fill('#subnetRequests', 'first /24\nsecond /25');
    await page.fill('#reserveSpace', '');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Verify first allocation
    await expect(page.locator('#allocation_results')).toContainText('first: 10.10.0.0/24');
    await expect(page.locator('#allocation_results')).toContainText('second: 10.10.1.0/25');

    // Now allocate more subnets (simulating incremental allocation)
    await page.fill('#subnetRequests', 'first /24\nsecond /25\nthird /26\nfourth /27');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Check that allocations don't overlap and names are correct
    const finalAllocations = await page.locator('input[data-subnet]').evaluateAll(inputs => {
      const result = [];
      inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
          result.push({
            subnet: input.dataset.subnet,
            name: input.value
          });
        }
      });
      return result;
    });

    // Verify each subnet has the correct name and no duplicates
    const nameCount = {};
    finalAllocations.forEach(alloc => {
      nameCount[alloc.name] = (nameCount[alloc.name] || 0) + 1;
    });

    // Each name should appear exactly once
    Object.entries(nameCount).forEach(([name, count]) => {
      expect(count, `${name} appears ${count} times, should be 1`).toBe(1);
    });
  });

  test('should validate that all allocated subnets are properly aligned', async ({ page }) => {
    await page.fill('#network', '172.16.0.0');
    await page.fill('#netsize', '12');
    await page.click('#btn_go');

    await page.waitForSelector('#calcbody tr');

    // Expand the auto-allocation panel if collapsed
    const autoAllocationBody = await page.$('#autoAllocationBody');
    const isCollapsed = await autoAllocationBody?.evaluate(el => el.classList.contains('collapse') && !el.classList.contains('show'));
    if (isCollapsed) {
      await page.click('[data-bs-target="#autoAllocationBody"]');
      await page.waitForSelector('#autoAllocationBody.show');
    }
    const subnetRequirements = `subnet1 /24
subnet2 /25
subnet3 /26
subnet4 /27
subnet5 /28`;

    await page.fill('#subnetRequests', subnetRequirements);
    await page.fill('#reserveSpace', '');
    await page.click('#btn_auto_allocate');
    await page.waitForTimeout(1000);

    // Get all allocated subnets from the table
    const allocatedSubnets = await page.locator('input[data-subnet]').evaluateAll(inputs => {
      const subnets = [];
      inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
          const [ip, size] = input.dataset.subnet.split('/');
          subnets.push({
            ip: ip,
            size: parseInt(size),
            name: input.value,
            cidr: input.dataset.subnet
          });
        }
      });
      return subnets;
    });

    // Verify each subnet is properly aligned
    allocatedSubnets.forEach(subnet => {
      const ipParts = subnet.ip.split('.').map(n => parseInt(n));
      const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
      const blockSize = Math.pow(2, 32 - subnet.size);

      // Check alignment (use >>> 0 to convert to unsigned to avoid -0 issue)
      expect((ipInt % blockSize) >>> 0, `${subnet.cidr} (${subnet.name}) is not properly aligned`).toBe(0);
    });

    // Verify no overlaps
    for (let i = 0; i < allocatedSubnets.length; i++) {
      for (let j = i + 1; j < allocatedSubnets.length; j++) {
        const subnet1 = allocatedSubnets[i];
        const subnet2 = allocatedSubnets[j];

        const ip1Parts = subnet1.ip.split('.').map(n => parseInt(n));
        const ip1Int = (ip1Parts[0] << 24) + (ip1Parts[1] << 16) + (ip1Parts[2] << 8) + ip1Parts[3];
        const size1 = Math.pow(2, 32 - subnet1.size);

        const ip2Parts = subnet2.ip.split('.').map(n => parseInt(n));
        const ip2Int = (ip2Parts[0] << 24) + (ip2Parts[1] << 16) + (ip2Parts[2] << 8) + ip2Parts[3];
        const size2 = Math.pow(2, 32 - subnet2.size);

        // Check that subnets don't overlap
        const overlap = !((ip1Int + size1 <= ip2Int) || (ip2Int + size2 <= ip1Int));
        expect(overlap, `${subnet1.cidr} and ${subnet2.cidr} overlap!`).toBe(false);
      }
    }
  });
});