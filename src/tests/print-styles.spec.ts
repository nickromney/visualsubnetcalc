import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8082',
  ignoreHTTPSErrors: false
});

test.describe('Print Styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Create a network to print
    await page.fill('#network', '10.0.0.0');
    await page.fill('#netsize', '24');
    await page.click('#btn_go');
    await page.waitForSelector('#calcbody tr');

    // Split to create some subnets
    await page.click('td.split[data-subnet="10.0.0.0/24"]');
    await page.waitForTimeout(200);

    // Add some notes - after splitting /24 we get /25
    await page.fill('input[data-subnet="10.0.0.0/25"]', 'Production Network');
    await page.fill('input[data-subnet="10.0.0.128/25"]', 'Development Network');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
  });

  test('should set print attributes on body element', async ({ page }) => {
    // Check that print attributes are set
    const printTitle = await page.getAttribute('body', 'data-print-title');
    expect(printTitle).toBe('10.0.0.0/24');

    const printUrl = await page.getAttribute('body', 'data-print-url');
    expect(printUrl).toContain('http://localhost:8082');
  });

  test('should hide UI elements in print media', async ({ page }) => {
    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Check that UI elements are hidden
    const alertVisible = await page.locator('.alert').first().isVisible();
    expect(alertVisible).toBe(false);

    const cardVisible = await page.locator('.card').first().isVisible();
    expect(cardVisible).toBe(false);

    const btnGoVisible = await page.locator('#btn_go').isVisible();
    expect(btnGoVisible).toBe(false);

    const h1Visible = await page.locator('h1').isVisible();
    expect(h1Visible).toBe(false);
  });

  test('should show table in print media', async ({ page }) => {
    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Check that table is visible
    const tableVisible = await page.locator('#calc').isVisible();
    expect(tableVisible).toBe(true);

    const theadVisible = await page.locator('#calc thead').isVisible();
    expect(theadVisible).toBe(true);

    const tbodyVisible = await page.locator('#calc tbody').isVisible();
    expect(tbodyVisible).toBe(true);
  });

  test('should show only essential columns and hide toggle button in print media', async ({ page }) => {
    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Check that the toggle button is hidden
    const toggleButtonVisible = await page.locator('#toggleColumns').isVisible();
    expect(toggleButtonVisible).toBe(false);

    // Get first row of tbody
    const firstRow = page.locator('#calcbody tr').first();

    // Check that essential columns are visible
    const subnetAddressVisible = await firstRow.locator('.row_address').isVisible();
    expect(subnetAddressVisible).toBe(true);

    const rangeVisible = await firstRow.locator('.row_range').isVisible();
    expect(rangeVisible).toBe(true);

    const hostsVisible = await firstRow.locator('.row_hosts').isVisible();
    expect(hostsVisible).toBe(true);

    const noteVisible = await firstRow.locator('.note').isVisible();
    expect(noteVisible).toBe(true);

    // Check that additional columns are hidden
    const ipVisible = await firstRow.locator('.row_ip').isVisible();
    expect(ipVisible).toBe(false);

    const cidrVisible = await firstRow.locator('.row_cidr').isVisible();
    expect(cidrVisible).toBe(false);

    const maskVisible = await firstRow.locator('.row_mask').isVisible();
    expect(maskVisible).toBe(false);

    // Check that usable IPs column is hidden
    const usableVisible = await firstRow.locator('.row_usable').isVisible();
    expect(usableVisible).toBe(false);

    // Check that split/join columns are hidden
    const splitVisible = await firstRow.locator('.split').isVisible();
    expect(splitVisible).toBe(false);

    const joinVisible = await firstRow.locator('.join').isVisible();
    expect(joinVisible).toBe(false);
  });

  test('should generate print-friendly content with CSS', async ({ page }) => {
    // Get computed styles in print media
    await page.emulateMedia({ media: 'print' });

    // Check that the table has proper print styles
    const tableStyles = await page.locator('#calc').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        width: styles.width,
        borderCollapse: styles.borderCollapse
      };
    });

    expect(tableStyles.display).toBe('table');
    // Width in print mode will be computed in pixels
    expect(parseInt(tableStyles.width)).toBeGreaterThan(0);
    expect(tableStyles.borderCollapse).toBe('collapse');

    // Check that cells have borders
    const cellStyles = await page.locator('#calc td').first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        borderWidth: styles.borderWidth,
        borderStyle: styles.borderStyle,
        borderColor: styles.borderColor
      };
    });

    expect(cellStyles.borderWidth).toContain('1px');
    expect(cellStyles.borderStyle).toContain('solid');
  });

  test('should preserve note values in print view', async ({ page }) => {
    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Check that notes are still visible
    const prodNote = await page.inputValue('input[data-subnet="10.0.0.0/25"]');
    expect(prodNote).toBe('Production Network');

    const devNote = await page.inputValue('input[data-subnet="10.0.0.128/25"]');
    expect(devNote).toBe('Development Network');
  });

  test('should create PDF with print styles', async ({ page, browserName }) => {
    // PDF generation is only supported in Chromium
    test.skip(browserName !== 'chromium', 'PDF generation is only supported in Chromium');

    // Generate a PDF to verify print styles work
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: false, // Don't print backgrounds for cleaner output
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in'
      }
    });

    // Verify PDF was generated (it will have content if print styles work)
    expect(pdf.length).toBeGreaterThan(1000); // A valid PDF should be at least 1KB
  });
});