import { expect, test } from "@playwright/test";

test.describe("Get started intake flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("cerniq_cookie_consent", "accepted");
    });
  });

  test("accepts a new institution intake and resolves into preview + paid upload", async ({
    page,
  }) => {
    await page.route("**/api/v1/leads/submit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "lead-1" }),
      });
    });

    await page.route("**/api/demo-request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/get-started");

    await page.getByPlaceholder("Your name").fill("Maria Rivera");
    await page.getByPlaceholder("you@institution.com").fill("maria@coop.pr");
    await page.getByPlaceholder("Institution name").fill("Cooperativa Norte");
    await page.getByRole("combobox").selectOption("cooperativa");
    await page.getByPlaceholder("Total assets (optional)").fill("$42,000,000");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Next step selected" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Preview sample output" }),
    ).toHaveAttribute("href", "/preview/cooperativa-oriental");
    await expect(
      page.getByRole("button", { name: "Unlock secure upload — $750" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Already paid? Open workspace" }),
    ).toHaveAttribute("href", "/login?mode=magic-link&returnUrl=%2Fdashboard");
  });
});
