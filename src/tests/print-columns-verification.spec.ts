import { test, expect } from "@playwright/test";

test.describe("Print Columns Verification", () => {
  test("should show exactly the right columns in print with additional columns", async ({ page }) => {
    await page.goto("http://localhost:8080");

    // Create a network
    await page.fill("#network", "10.0.0.0");
    await page.fill("#netsize", "24");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(200);

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Check which headers are visible
    const headers = {
      subnet: await page.locator("#subnetHeader").isVisible(),
      ip: await page.locator("#ipHeader").isVisible(),
      cidr: await page.locator("#cidrHeader").isVisible(),
      mask: await page.locator("#maskHeader").isVisible(),
      type: await page.locator("#typeHeader").isVisible(),
      range: await page.locator("#rangeHeader").isVisible(),
      usable: await page.locator("#useableHeader").isVisible(),
      hosts: await page.locator("#hostsHeader").isVisible(),
      note: await page.locator("#noteHeader").isVisible(),
    };

    // All columns should be visible (including Usable IPs)
    expect(headers.subnet).toBe(true);
    expect(headers.ip).toBe(true);
    expect(headers.cidr).toBe(true);
    expect(headers.mask).toBe(true);
    expect(headers.type).toBe(true);
    expect(headers.range).toBe(true);
    expect(headers.usable).toBe(true);  // Should be visible with additional columns
    expect(headers.hosts).toBe(true);
    expect(headers.note).toBe(true);

    // Check the first row cells
    const firstRow = page.locator("#calcbody tr").first();
    const cells = {
      address: await firstRow.locator(".row_address").isVisible(),
      ip: await firstRow.locator(".row_ip").isVisible(),
      cidr: await firstRow.locator(".row_cidr").isVisible(),
      mask: await firstRow.locator(".row_mask").isVisible(),
      type: await firstRow.locator(".row_type").isVisible(),
      range: await firstRow.locator(".row_range").isVisible(),
      usable: await firstRow.locator(".row_usable").isVisible(),
      hosts: await firstRow.locator(".row_hosts").isVisible(),
      note: await firstRow.locator(".note").isVisible(),
      split: await firstRow.locator(".split").isVisible(),
      join: await firstRow.locator(".join").isVisible(),
    };

    // These should be visible
    expect(cells.address).toBe(true);
    expect(cells.ip).toBe(true);
    expect(cells.cidr).toBe(true);
    expect(cells.mask).toBe(true);
    expect(cells.type).toBe(true);
    expect(cells.range).toBe(true);
    expect(cells.usable).toBe(true);  // Should be visible with additional columns
    expect(cells.hosts).toBe(true);
    expect(cells.note).toBe(true);

    // These should be hidden (UI-only columns)
    expect(cells.split).toBe(false);
    expect(cells.join).toBe(false);

    // Count total visible headers (should be 9: all including Usable IPs)
    const visibleHeaders = await page.locator("#calc thead th:visible").count();
    expect(visibleHeaders).toBe(9);
  });

  test("should show only essential columns in print without additional columns", async ({ page }) => {
    await page.goto("http://localhost:8080");

    // Create a network
    await page.fill("#network", "10.0.0.0");
    await page.fill("#netsize", "24");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Don't toggle additional columns - keep them hidden

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Check which headers are visible
    const headers = {
      subnet: await page.locator("#subnetHeader").isVisible(),
      ip: await page.locator("#ipHeader").isVisible(),
      cidr: await page.locator("#cidrHeader").isVisible(),
      mask: await page.locator("#maskHeader").isVisible(),
      type: await page.locator("#typeHeader").isVisible(),
      range: await page.locator("#rangeHeader").isVisible(),
      usable: await page.locator("#useableHeader").isVisible(),
      hosts: await page.locator("#hostsHeader").isVisible(),
      note: await page.locator("#noteHeader").isVisible(),
    };

    // Only essential columns should be visible
    expect(headers.subnet).toBe(true);
    expect(headers.range).toBe(true);
    expect(headers.hosts).toBe(true);
    expect(headers.note).toBe(true);

    // Additional columns should be hidden
    expect(headers.ip).toBe(false);
    expect(headers.cidr).toBe(false);
    expect(headers.mask).toBe(false);
    expect(headers.type).toBe(false);
    expect(headers.usable).toBe(false);

    // Count total visible headers (should be 4: Subnet, Range, Hosts, Note)
    const visibleHeaders = await page.locator("#calc thead th:visible").count();
    expect(visibleHeaders).toBe(4);
  });
});