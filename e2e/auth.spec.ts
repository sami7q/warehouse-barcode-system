import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./credentials";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("authentication", () => {
  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("تسجيل الدخول")).toBeVisible();
  });

  test("wrong password shows an error and stays on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill("wrong-password-123");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByTestId("login-error")).toContainText(
      "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test("correct credentials log in and reach the main screen", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByText("البحث عن منتج")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("إدارة المخازن").first()).toBeVisible();
  });

  test("API routes return 401 JSON when unauthenticated", async ({
    request,
  }) => {
    const res = await request.get("/api/products");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
