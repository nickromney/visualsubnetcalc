import { test, expect } from "@playwright/test";

test.describe("Mirror Network Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080");
    await page.waitForLoadState("networkidle");
  });

  test("should show Mirror button", async ({ page }) => {
    // Check that the Mirror button is visible
    const mirrorButton = page.locator("#generateMirror");
    await expect(mirrorButton).toBeVisible();
    await expect(mirrorButton).toContainText("Mirror");
  });

  test("should handle no network gracefully", async ({ page }) => {
    // Click Generate Mirror without a network
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // The modal opens but shows default network 10.0.0.0/16
    const mirrorModal = page.locator("#mirrorModal");
    await expect(mirrorModal).toBeVisible();

    // It defaults to a /16 network suggestion
    const hint = page.locator("#mirrorSizeHint");
    await expect(hint).toContainText(
      "Enter the base network for the mirror (must use same CIDR size as original - /16)"
    );
  });

  test("should open mirror modal when network exists", async ({ page }) => {
    // Set up a network first
    await page.fill("#network", "10.100.0.0");
    await page.fill("#netsize", "16");
    await page.click("#btn_go");
    await page.waitForTimeout(500);

    // Split to create subnets
    await page.locator("td.split").first().click();
    await page.waitForTimeout(500);

    // Add notes
    await page.fill('input[data-subnet="10.100.0.0/17"]', "Subnet A");
    await page.fill('input[data-subnet="10.100.128.0/17"]', "Subnet B");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Click Generate Mirror
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Check that mirror modal is visible
    const mirrorModal = page.locator("#mirrorModal");
    await expect(mirrorModal).toBeVisible();

    // Check that it suggests a mirror network (10.200.0.0)
    const mirrorInput = page.locator("#mirrorNetwork");
    const suggestedValue = await mirrorInput.inputValue();
    expect(suggestedValue).toBe("10.200.0.0");
  });

  test("should generate mirror with same CIDR sizes", async ({ page }) => {
    // Set up a network
    await page.fill("#network", "10.100.0.0");
    await page.fill("#netsize", "16");
    await page.click("#btn_go");
    await page.waitForTimeout(500);

    // Split to create specific subnets
    await page.locator("td.split").first().click();
    await page.waitForTimeout(500);

    // Split first subnet further
    await page.locator('td.split[data-subnet="10.100.0.0/17"]').click();
    await page.waitForTimeout(500);

    // Add notes to identify subnets
    await page.fill('input[data-subnet="10.100.0.0/18"]', "Web Tier");
    await page.fill('input[data-subnet="10.100.64.0/18"]', "App Tier");
    await page.fill('input[data-subnet="10.100.128.0/17"]', "Database");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Click Generate Mirror
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Enter mirror details
    await page.fill("#mirrorNetwork", "10.200.0.0");
    await page.fill("#mirrorLabel", "DR Site");

    // Confirm mirror generation
    await page.click("#confirmMirror");
    await page.waitForTimeout(1500); // Wait for auto-allocation to complete

    // Verify that the new table has the mirrored subnets
    const rows = await page.locator("#calcbody tr").all();
    expect(rows.length).toBeGreaterThan(0);

    // Check that notes are preserved (without automatic label appending)
    const firstNote = await page
      .locator('input[data-subnet="10.200.0.0/18"]')
      .inputValue();
    expect(firstNote).toBe("Web Tier");

    const secondNote = await page
      .locator('input[data-subnet="10.200.64.0/18"]')
      .inputValue();
    expect(secondNote).toBe("App Tier");

    const thirdNote = await page
      .locator('input[data-subnet="10.200.128.0/17"]')
      .inputValue();
    expect(thirdNote).toBe("Database");
  });

  test("should validate mirror network alignment", async ({ page }) => {
    // Set up a /16 network
    await page.fill("#network", "10.0.0.0");
    await page.fill("#netsize", "16");
    await page.click("#btn_go");
    await page.waitForTimeout(500);

    // Click Generate Mirror
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Try to enter a misaligned mirror network
    await page.fill("#mirrorNetwork", "10.1.1.0"); // Not aligned to /16
    await page.waitForTimeout(200);

    // Check that validation shows error
    const mirrorInput = page.locator("#mirrorNetwork");
    await expect(mirrorInput).toHaveClass(/is-invalid/);

    // Check error message
    const hint = page.locator("#mirrorSizeHint");
    await expect(hint).toContainText("Network must be aligned to /16 boundary");

    // Confirm button should be disabled
    const confirmButton = page.locator("#confirmMirror");
    await expect(confirmButton).toBeDisabled();
  });
});
