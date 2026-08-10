import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./credentials";

/**
 * "تذكرني" (remember me) — the exact resulting session-length difference is
 * covered at the unit level (tests/unit/session-duration.test.ts), since
 * verifying it end-to-end would require decrypting Auth.js v5's session JWE
 * (a per-cookie-salted encryption scheme not worth reimplementing in a
 * test). These e2e tests instead prove the checkbox and both code paths
 * actually work in the running app: present, defaults to checked, and login
 * succeeds (with a real session cookie issued) whether checked or not.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("تذكرني checkbox", () => {
  test("is present and checked by default", async ({ page }) => {
    await page.goto("/login");
    const checkbox = page.getByTestId("remember-me");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
  });

  test("login succeeds with تذكرني checked and issues a session cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await expect(page.getByTestId("remember-me")).toBeChecked();
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByText("البحث عن منتج")).toBeVisible({
      timeout: 15000,
    });

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes("session-token"),
    );
    expect(sessionCookie).toBeTruthy();
  });

  test("login succeeds with تذكرني unchecked and still issues a session cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByTestId("remember-me").uncheck();
    await expect(page.getByTestId("remember-me")).not.toBeChecked();
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByText("البحث عن منتج")).toBeVisible({
      timeout: 15000,
    });

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes("session-token"),
    );
    expect(sessionCookie).toBeTruthy();

    // Session remains valid for API calls right after a fresh (unremembered) login.
    const res = await page.request.get("/api/products");
    expect(res.status()).toBe(200);
  });
});
