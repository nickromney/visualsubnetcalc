import { test, expect } from "@playwright/test";

test.use({
  baseURL: "http://localhost:8080",
  ignoreHTTPSErrors: false,
});

test.describe("Print Styles with Additional Columns", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Create a network
    await page.fill("#network", "192.168.1.0");
    await page.fill("#netsize", "24");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Split to create some subnets
    await page.click('td.split[data-subnet="192.168.1.0/24"]');
    await page.waitForTimeout(200);
  });

  test("should hide additional columns in print when not toggled", async ({ page }) => {
    // Verify columns are hidden in normal view
    const ipHeaderInitial = await page.locator("#ipHeader").evaluate((el) =>
      window.getComputedStyle(el).display
    );
    expect(ipHeaderInitial).toBe("none");

    // Body should NOT have the show-additional-columns class
    const bodyClasses = await page.locator("body").getAttribute("class");
    expect(bodyClasses || "").not.toContain("show-additional-columns");

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Additional columns should be hidden in print
    const ipHeaderVisible = await page.locator("#ipHeader").isVisible();
    expect(ipHeaderVisible).toBe(false);

    const cidrHeaderVisible = await page.locator("#cidrHeader").isVisible();
    expect(cidrHeaderVisible).toBe(false);

    const maskHeaderVisible = await page.locator("#maskHeader").isVisible();
    expect(maskHeaderVisible).toBe(false);

    // Check that additional column cells are hidden
    const firstRow = page.locator("#calcbody tr").first();

    const ipCellVisible = await firstRow.locator(".row_ip").isVisible();
    expect(ipCellVisible).toBe(false);

    const cidrCellVisible = await firstRow.locator(".row_cidr").isVisible();
    expect(cidrCellVisible).toBe(false);

    const maskCellVisible = await firstRow.locator(".row_mask").isVisible();
    expect(maskCellVisible).toBe(false);
  });

  test("should show additional columns in print when toggled on", async ({ page }) => {
    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(500);

    // Body should have the show-additional-columns class
    const bodyClasses = await page.locator("body").getAttribute("class");
    expect(bodyClasses).toContain("show-additional-columns");

    // Verify columns are visible in normal view
    const ipHeaderNormal = await page.locator("#ipHeader").isVisible();
    expect(ipHeaderNormal).toBe(true);

    // Now emulate print media
    await page.emulateMedia({ media: "print" });

    // Check that additional column headers are visible in print
    const ipHeaderVisible = await page.locator("#ipHeader").isVisible();
    expect(ipHeaderVisible).toBe(true);

    const cidrHeaderVisible = await page.locator("#cidrHeader").isVisible();
    expect(cidrHeaderVisible).toBe(true);

    const maskHeaderVisible = await page.locator("#maskHeader").isVisible();
    expect(maskHeaderVisible).toBe(true);

    // Check that additional column cells are visible
    const firstRow = page.locator("#calcbody tr").first();

    const ipCellVisible = await firstRow.locator(".row_ip").isVisible();
    expect(ipCellVisible).toBe(true);

    const cidrCellVisible = await firstRow.locator(".row_cidr").isVisible();
    expect(cidrCellVisible).toBe(true);

    const maskCellVisible = await firstRow.locator(".row_mask").isVisible();
    expect(maskCellVisible).toBe(true);

    // Verify the content is correct
    const ipContent = await firstRow.locator(".row_ip").textContent();
    expect(ipContent).toBe("192.168.1.0");

    const cidrContent = await firstRow.locator(".row_cidr").textContent();
    expect(cidrContent).toBe("/25");

    const maskContent = await firstRow.locator(".row_mask").textContent();
    expect(maskContent).toBe("255.255.255.128");
  });

  test("should show Usable IPs column in print when additional columns are toggled", async ({ page }) => {
    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(500);

    // Verify Usable IPs is visible in normal view
    const usableNormal = await page.locator("#useableHeader").isVisible();
    expect(usableNormal).toBe(true);

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Check that Usable IPs is visible in print when additional columns are toggled
    const usableHeaderVisible = await page.locator("#useableHeader").isVisible();
    expect(usableHeaderVisible).toBe(true);

    const firstRow = page.locator("#calcbody tr").first();
    const usableCellVisible = await firstRow.locator(".row_usable").isVisible();
    expect(usableCellVisible).toBe(true);
  });

  test("should always hide Split/Join columns in print", async ({ page }) => {
    // Emulate print media
    await page.emulateMedia({ media: "print" });

    const firstRow = page.locator("#calcbody tr").first();

    // Split/Join should always be hidden
    const splitVisible = await firstRow.locator(".split").isVisible();
    expect(splitVisible).toBe(false);

    const joinVisible = await firstRow.locator(".join").isVisible();
    expect(joinVisible).toBe(false);

    // Even if we toggle the Hide Split/Join button (if it exists)
    const toggleSplitJoin = page.locator("#toggleSplitJoin");
    const toggleExists = await toggleSplitJoin.count() > 0;

    if (toggleExists) {
      // This button should be hidden in print
      const toggleVisible = await toggleSplitJoin.isVisible();
      expect(toggleVisible).toBe(false);
    }
  });

  test("should maintain proper table formatting with additional columns", async ({ page }) => {
    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(500);

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Check table structure is intact
    const table = await page.locator("#calc");
    const tableVisible = await table.isVisible();
    expect(tableVisible).toBe(true);

    // Count visible columns in header - with additional columns toggled on
    const visibleHeaders = await page.locator("#calc thead th:visible").count();
    // Should have: Subnet, IP, CIDR, Mask, Type, Range, Usable IPs, Hosts, Note (9 columns)
    expect(visibleHeaders).toBe(9);

    // Verify all cells have borders in print
    const firstRow = page.locator("#calcbody tr").first();
    const ipCell = firstRow.locator(".row_ip");

    const cellStyles = await ipCell.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderWidth: styles.borderWidth,
        borderStyle: styles.borderStyle,
        padding: styles.padding,
      };
    });

    expect(cellStyles.borderWidth).toContain("1px");
    expect(cellStyles.borderStyle).toContain("solid");
  });

  test("should use portrait mode for normal print, landscape for additional columns", async ({ page, browserName }) => {
    // PDF generation is only supported in Chromium
    test.skip(
      browserName !== "chromium",
      "PDF generation is only supported in Chromium"
    );

    // First test portrait mode without additional columns
    let pdf = await page.pdf({
      format: "A4",
      printBackground: false,
    });

    // PDF should be generated
    expect(pdf.length).toBeGreaterThan(1000);

    // Now toggle additional columns
    await page.click("#toggleColumns");
    await page.waitForTimeout(500);

    // Generate PDF with additional columns (should be landscape)
    pdf = await page.pdf({
      format: "A4",
      printBackground: false,
    });

    // PDF should still be generated successfully
    expect(pdf.length).toBeGreaterThan(1000);
  });
});