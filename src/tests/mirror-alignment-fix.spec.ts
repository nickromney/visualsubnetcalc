import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8080',
  ignoreHTTPSErrors: false
});

test.describe('Mirror Network Alignment Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should correctly validate aligned /22 networks (172.30.4.0 -> 172.22.4.0)', async ({ page }) => {
    // Set up source network
    await page.fill('#network', '172.30.4.0');
    await page.fill('#netsize', '22');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Open mirror modal
    await page.click('#btn_mirror_network');
    await page.waitForSelector('#mirrorNetworkModal.show');

    // Enter mirror network that IS properly aligned to /22
    await page.fill('#mirrorNetwork', '172.22.4.0');

    // Wait for validation
    await page.waitForTimeout(500);

    // Check that the input is marked as valid
    const isValid = await page.$eval('#mirrorNetwork', el => el.classList.contains('is-valid'));
    expect(isValid).toBe(true);

    // Check that buttons are enabled
    const copyButtonDisabled = await page.$eval('#copySourceAndMirror', el => el.disabled);
    const confirmButtonDisabled = await page.$eval('#confirmMirror', el => el.disabled);
    expect(copyButtonDisabled).toBe(false);
    expect(confirmButtonDisabled).toBe(false);

    // Check the hint message is correct
    const hintText = await page.textContent('#mirrorSizeHint');
    expect(hintText).toContain('must use same CIDR size as original - /22');
    expect(hintText).not.toContain('must be aligned');
  });

  test('should correctly reject misaligned /22 networks (172.30.4.0 -> 172.22.5.0)', async ({ page }) => {
    // Set up source network
    await page.fill('#network', '172.30.4.0');
    await page.fill('#netsize', '22');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Open mirror modal
    await page.click('#btn_mirror_network');
    await page.waitForSelector('#mirrorNetworkModal.show');

    // Enter mirror network that is NOT properly aligned to /22
    await page.fill('#mirrorNetwork', '172.22.5.0');

    // Wait for validation
    await page.waitForTimeout(500);

    // Check that the input is marked as invalid
    const isInvalid = await page.$eval('#mirrorNetwork', el => el.classList.contains('is-invalid'));
    expect(isInvalid).toBe(true);

    // Check that buttons are disabled
    const copyButtonDisabled = await page.$eval('#copySourceAndMirror', el => el.disabled);
    const confirmButtonDisabled = await page.$eval('#confirmMirror', el => el.disabled);
    expect(copyButtonDisabled).toBe(true);
    expect(confirmButtonDisabled).toBe(true);

    // Check the error message
    const hintText = await page.textContent('#mirrorSizeHint');
    expect(hintText).toContain('Network must be aligned to /22 boundary');
  });

  test('should validate various aligned networks at different CIDR sizes', async ({ page }) => {
    const testCases = [
      { source: '10.0.0.0', size: '24', validMirror: '10.1.0.0', invalidMirror: '10.1.0.128' },
      { source: '192.168.0.0', size: '16', validMirror: '172.16.0.0', invalidMirror: '172.16.1.0' },
      { source: '10.0.0.0', size: '8', validMirror: '172.0.0.0', invalidMirror: '172.1.0.0' },
      { source: '10.128.0.0', size: '9', validMirror: '10.0.0.0', invalidMirror: '10.64.0.0' }
    ];

    for (const testCase of testCases) {
      // Set up source network
      await page.fill('#network', testCase.source);
      await page.fill('#netsize', testCase.size);
      await page.click('#btn_go');
      await page.waitForSelector('#calcbody tr');

      // Open mirror modal
      await page.click('#btn_mirror_network');
      await page.waitForSelector('#mirrorNetworkModal.show');

      // Test valid mirror
      await page.fill('#mirrorNetwork', testCase.validMirror);
      await page.waitForTimeout(300);

      const isValid = await page.$eval('#mirrorNetwork', el => el.classList.contains('is-valid'));
      expect(isValid).toBe(true);

      // Test invalid mirror
      await page.fill('#mirrorNetwork', '');
      await page.fill('#mirrorNetwork', testCase.invalidMirror);
      await page.waitForTimeout(300);

      const isInvalid = await page.$eval('#mirrorNetwork', el => el.classList.contains('is-invalid'));
      expect(isInvalid).toBe(true);

      // Close modal for next test
      await page.click('#mirrorNetworkModal .btn-close');
      await page.waitForSelector('#mirrorNetworkModal', { state: 'hidden' });

      // Reset for next test
      await page.click('#btn_reset');
      await page.waitForTimeout(300);
    }
  });
});