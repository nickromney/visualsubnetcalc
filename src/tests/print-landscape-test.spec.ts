import { test, expect } from "@playwright/test";

test.describe("Print Landscape Orientation", () => {
  test("should add landscape style tag when additional columns are toggled", async ({ page }) => {
    await page.goto("http://localhost:8080");

    // Create a network
    await page.fill("#network", "192.168.1.0");
    await page.fill("#netsize", "24");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Initially no landscape style
    let landscapeStyle = await page.locator("#landscape-print-style").count();
    expect(landscapeStyle).toBe(0);

    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(200);

    // Landscape style should be added
    landscapeStyle = await page.locator("#landscape-print-style").count();
    expect(landscapeStyle).toBe(1);

    // Check the content of the style tag
    const styleContent = await page.locator("#landscape-print-style").textContent();
    expect(styleContent).toContain("@page");
    expect(styleContent).toContain("landscape");

    // Toggle off
    await page.click("#toggleColumns");
    await page.waitForTimeout(200);

    // Landscape style should be removed
    landscapeStyle = await page.locator("#landscape-print-style").count();
    expect(landscapeStyle).toBe(0);
  });

  test("should show Usable IPs in print when additional columns are toggled", async ({ page }) => {
    await page.goto("http://localhost:8080");

    // Create a network
    await page.fill("#network", "10.0.0.0");
    await page.fill("#netsize", "24");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(200);

    // Verify Usable IPs is visible in normal view
    const usableNormal = await page.locator("#useableHeader").isVisible();
    expect(usableNormal).toBe(true);

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Usable IPs should be visible in print when additional columns are toggled
    const usableInPrint = await page.locator("#useableHeader").isVisible();
    expect(usableInPrint).toBe(true);

    const firstRow = page.locator("#calcbody tr").first();
    const usableCell = await firstRow.locator(".row_usable").isVisible();
    expect(usableCell).toBe(true);
  });

  test("should generate landscape PDF when additional columns are shown", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "PDF generation only works in Chromium");

    await page.goto("http://localhost:8080");

    // Create a network
    await page.fill("#network", "172.16.0.0");
    await page.fill("#netsize", "16");
    await page.click("#btn_go");
    await page.waitForSelector("#calcbody tr");

    // Toggle additional columns on
    await page.click("#toggleColumns");
    await page.waitForTimeout(200);

    // Verify landscape style is present
    const landscapeStyle = await page.locator("#landscape-print-style").count();
    expect(landscapeStyle).toBe(1);

    // Generate PDF - it should use landscape orientation
    const pdf = await page.pdf({
      format: "A4",
      printBackground: false,
    });

    // PDF should be generated
    expect(pdf.length).toBeGreaterThan(1000);
  });
});