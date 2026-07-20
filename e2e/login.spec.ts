import { expect, test } from "@playwright/test";

test.describe("Auth page (/login)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows branding and the login form by default", async ({ page }) => {
    await expect(page.getByText("Teacher AI").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "托班周报" }),
    ).toBeVisible();

    await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "邀请码注册" }),
    ).toBeVisible();

    // Login submit button present; invite-code field absent.
    await expect(
      page.getByRole("button", { name: "登录", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("邀请码", { exact: true })).toHaveCount(0);
  });

  test("reveals the invite-code field when switching to registration", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "邀请码注册" }).click();

    await expect(page.getByText("邀请码", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "注册并登录" }),
    ).toBeVisible();
  });

  test("does not submit a registration with empty required fields", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "邀请码注册" }).click();
    await page.getByRole("button", { name: "注册并登录" }).click();

    // HTML5 required validation blocks the submit — we stay on /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("邀请码", { exact: true })).toBeVisible();
  });
});
