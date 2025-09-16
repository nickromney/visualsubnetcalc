import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Browser History Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should update URL and enable back/forward navigation for split/join operations', async ({ page }) => {
    // Create initial network
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Get initial URL
    const initialUrl = page.url();

    // Split the first subnet
    await page.click('td.split[data-subnet="10.0.0.0/24"]');
    await page.waitForTimeout(200);

    // URL should have changed
    const afterSplitUrl = page.url();
    expect(afterSplitUrl).not.toBe(initialUrl);
    expect(afterSplitUrl).toContain('?c=');

    // Should see two /25 subnets
    await expect(page.locator('#calcbody')).toContainText('10.0.0.0/25');
    await expect(page.locator('#calcbody')).toContainText('10.0.0.128/25');

    // Split the first /25 into /26s
    await page.click('td.split[data-subnet="10.0.0.0/25"]');
    await page.waitForTimeout(200);

    const afterSecondSplitUrl = page.url();
    expect(afterSecondSplitUrl).not.toBe(afterSplitUrl);

    // Should see /26 subnets
    await expect(page.locator('#calcbody')).toContainText('10.0.0.0/26');
    await expect(page.locator('#calcbody')).toContainText('10.0.0.64/26');

    // Go back using browser back button
    await page.goBack();
    await page.waitForTimeout(200);

    // Should be back to two /25 subnets
    expect(page.url()).toBe(afterSplitUrl);
    await expect(page.locator('#calcbody')).toContainText('10.0.0.0/25');
    await expect(page.locator('#calcbody')).toContainText('10.0.0.128/25');
    await expect(page.locator('#calcbody')).not.toContainText('/26');

    // Go back again
    await page.goBack();
    await page.waitForTimeout(200);

    // Should be back to single /24
    expect(page.url()).toBe(initialUrl);
    await expect(page.locator('#calcbody')).toContainText('10.0.0.0/24');
    await expect(page.locator('#calcbody')).not.toContainText('/25');

    // Go forward
    await page.goForward();
    await page.waitForTimeout(200);

    // Should be back to two /25s
    expect(page.url()).toBe(afterSplitUrl);
    await expect(page.locator('#calcbody')).toContainText('10.0.0.0/25');
    await expect(page.locator('#calcbody')).toContainText('10.0.0.128/25');
  });

  test('should update URL when adding notes', async ({ page }) => {
    // Create initial network
    await page.fill('#network', '192.168.1.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    const initialUrl = page.url();

    // Split first to create a history entry
    await page.click('td.split[data-subnet="192.168.1.0/24"]');
    await page.waitForTimeout(200);

    // Add a note to first subnet
    await page.fill('input[data-subnet="192.168.1.0/25"]', 'Test Network');
    // Trigger blur to save immediately
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    const afterNoteUrl = page.url();
    expect(afterNoteUrl).not.toBe(initialUrl);

    // Go back (should remove the note)
    await page.goBack();
    await page.waitForTimeout(200);

    // Note should be gone but split should remain
    await expect(page.locator('input[data-subnet="192.168.1.0/25"]')).toHaveValue('');

    // Go forward
    await page.goForward();
    await page.waitForTimeout(200);

    // Note should be back
    await expect(page.locator('input[data-subnet="192.168.1.0/25"]')).toHaveValue('Test Network');
  });

  test('should handle join operations with history', async ({ page }) => {
    // Create initial network and split it
    await page.fill('#network', '172.16.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Split into /25s
    await page.click('td.split[data-subnet="172.16.0.0/24"]');
    await page.waitForTimeout(200);

    // Split first /25 into /26s
    await page.click('td.split[data-subnet="172.16.0.0/25"]');
    await page.waitForTimeout(200);

    // Split second /25 into /26s
    await page.click('td.split[data-subnet="172.16.0.128/25"]');
    await page.waitForTimeout(200);

    // Now we have four /26s
    await expect(page.locator('#calcbody')).toContainText('172.16.0.0/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.64/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.128/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.192/26');

    const beforeJoinUrl = page.url();

    // Join the first two /26s back into a /25 (join uses the parent subnet)
    await page.click('td.join[data-subnet="172.16.0.0/25"]');
    await page.waitForTimeout(200);

    const afterJoinUrl = page.url();
    expect(afterJoinUrl).not.toBe(beforeJoinUrl);

    // Should have one /25 and two /26s
    await expect(page.locator('#calcbody')).toContainText('172.16.0.0/25');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.128/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.192/26');

    // Go back
    await page.goBack();
    await page.waitForTimeout(200);

    // Should have four /26s again
    await expect(page.locator('#calcbody')).toContainText('172.16.0.0/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.64/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.128/26');
    await expect(page.locator('#calcbody')).toContainText('172.16.0.192/26');
  });
});