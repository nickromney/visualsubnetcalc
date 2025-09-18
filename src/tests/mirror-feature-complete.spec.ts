import { test, expect } from "@playwright/test";

test.describe("Mirror Network Feature - Complete Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080");
    await page.waitForLoadState("networkidle");

    // Set up a basic network
    await page.fill("#network", "10.0.0.0");
    await page.fill("#netsize", "16");
    await page.click("#btn_go");
    await page.waitForTimeout(500);
  });

  test("should show Mirror button with correct label", async ({ page }) => {
    const mirrorButton = page.locator("#generateMirror");
    await expect(mirrorButton).toBeVisible();
    await expect(mirrorButton).toContainText("Mirror");
  });

  test("should show modal with Blue/Green default labels", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Check modal is visible
    const mirrorModal = page.locator("#mirrorModal");
    await expect(mirrorModal).toBeVisible();

    // Check default labels
    const sourceLabel = page.locator("#sourceLabel");
    const mirrorLabel = page.locator("#mirrorLabel");

    await expect(sourceLabel).toHaveValue("Blue");
    await expect(mirrorLabel).toHaveValue("Green");
  });

  test("should validate invalid IP addresses", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Try invalid IP
    await page.fill("#mirrorNetwork", "500.300.200.100");
    await page.waitForTimeout(200);

    // Check for invalid class
    const mirrorInput = page.locator("#mirrorNetwork");
    await expect(mirrorInput).toHaveClass(/is-invalid/);

    // Check error message
    const hint = page.locator("#mirrorSizeHint");
    await expect(hint).toContainText("Invalid IP address format");

    // Check buttons are disabled
    const copyButton = page.locator("#copySourceAndMirror");
    const replaceButton = page.locator("#confirmMirror");
    await expect(copyButton).toBeDisabled();
    await expect(replaceButton).toBeDisabled();
  });

  test("should validate network alignment", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Try misaligned IP for /16
    await page.fill("#mirrorNetwork", "10.1.1.0");
    await page.waitForTimeout(200);

    // Check for invalid class
    const mirrorInput = page.locator("#mirrorNetwork");
    await expect(mirrorInput).toHaveClass(/is-invalid/);

    // Check error message
    const hint = page.locator("#mirrorSizeHint");
    await expect(hint).toContainText("Network must be aligned to /16 boundary");

    // Check buttons are disabled
    await expect(page.locator("#copySourceAndMirror")).toBeDisabled();
    await expect(page.locator("#confirmMirror")).toBeDisabled();
  });

  test("should accept valid aligned network", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Enter valid aligned IP
    await page.fill("#mirrorNetwork", "10.200.0.0");
    await page.waitForTimeout(200);

    // Check for valid class
    const mirrorInput = page.locator("#mirrorNetwork");
    await expect(mirrorInput).toHaveClass(/is-valid/);

    // Check buttons are enabled
    await expect(page.locator("#copySourceAndMirror")).toBeEnabled();
    await expect(page.locator("#confirmMirror")).toBeEnabled();
  });

  test("should copy source and mirror with custom labels", async ({ page }) => {
    // Add some subnets first
    await page.locator("td.split").first().click();
    await page.waitForTimeout(500);
    await page.fill('input[data-subnet="10.0.0.0/17"]', "Web Tier");
    await page.fill('input[data-subnet="10.0.128.0/17"]', "App Tier");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Open mirror modal
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Set custom labels
    await page.fill("#sourceLabel", "Production");
    await page.fill("#mirrorLabel", "Staging");
    await page.fill("#mirrorNetwork", "10.100.0.0");
    await page.waitForTimeout(200);

    // Copy source and mirror
    await page.click("#copySourceAndMirror");
    await page.waitForTimeout(500);

    // Check button shows success
    const copyButton = page.locator("#copySourceAndMirror");
    await expect(copyButton).toContainText("Copied!");

    // Verify clipboard content (if possible in test environment)
    // Note: Actual clipboard access may require special permissions
  });

  test("should replace source with mirror", async ({ page }) => {
    // Add a subnet
    await page.locator("td.split").first().click();
    await page.waitForTimeout(500);

    // Open mirror modal
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Enter mirror network
    await page.fill("#mirrorNetwork", "192.168.0.0");
    await page.waitForTimeout(200);

    // Replace with mirror
    await page.click("#confirmMirror");
    await page.waitForTimeout(1500);

    // Check that network has been replaced
    const networkInput = await page.locator("#network").inputValue();
    expect(networkInput).toBe("192.168.0.0");

    // Check that subnets have been mirrored
    const firstSubnet = await page
      .locator(".row_address")
      .first()
      .textContent();
    expect(firstSubnet).toContain("192.168");
  });

  test("should show both action buttons in modal", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Check both buttons are present
    const copyButton = page.locator("#copySourceAndMirror");
    const replaceButton = page.locator("#confirmMirror");

    await expect(copyButton).toBeVisible();
    await expect(copyButton).toContainText("Copy Source and Mirror");

    await expect(replaceButton).toBeVisible();
    await expect(replaceButton).toContainText("Replace Source with Mirror");
  });

  test("should suggest mirror network intelligently", async ({ page }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Check that a suggestion is pre-filled
    const mirrorInput = page.locator("#mirrorNetwork");
    const suggestedValue = await mirrorInput.inputValue();

    // Should suggest something like 10.100.0.0 for 10.0.0.0
    expect(suggestedValue).toBeTruthy();
    expect(suggestedValue).not.toBe("10.0.0.0"); // Should be different from source
  });

  test("should validate on modal open with pre-filled value", async ({
    page,
  }) => {
    await page.click("#generateMirror");
    await page.waitForTimeout(500);

    // Check that validation has run on the pre-filled value
    const mirrorInput = page.locator("#mirrorNetwork");
    const suggestedValue = await mirrorInput.inputValue();

    if (suggestedValue) {
      // Should have either valid or invalid class
      const hasValidation = await mirrorInput.evaluate(
        (el) =>
          el.classList.contains("is-valid") ||
          el.classList.contains("is-invalid")
      );
      expect(hasValidation).toBeTruthy();
    }
  });
});
