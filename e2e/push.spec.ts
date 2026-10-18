import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { createEmployeeViaApi, createProductViaApi } from "./helpers";

/**
 * Real-browser half of the Web Push feature (the server half — VAPID
 * signing, encryption, fan-out, cleanup — is covered by
 * tests/integration/push.test.ts).
 */

// The default chromium-headless-shell has no notification support at all
// (permission always reads "denied"); full Chromium's new headless does.
test.use({ channel: "chromium" });

test("push assets are reachable without a session", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  for (const url of ["/sw.js", "/manifest.webmanifest", "/icon-192.png", "/badge-96.png"]) {
    const res = await page.request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
  }
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  await ctx.close();
});

test.describe("employee device", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a product added by the admin reaches the employee as a real push, even with the app closed", async ({
    browser,
    baseURL,
  }) => {
    // Genuine end-to-end: server → web-push → Google FCM → this browser →
    // public/sw.js → system notification. Needs internet; a fresh profile's
    // first FCM registration alone can take ~30s.
    test.setTimeout(180_000);
    const adminCtx = await browser.newContext({ storageState: "e2e/.auth/state.json" });
    const adminPage = await adminCtx.newPage();
    const employee = await createEmployeeViaApi(adminPage);

    // Chrome disables the Push API in incognito, and every regular
    // Playwright context is incognito-like — a real profile dir is needed.
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "push-e2e-"));
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      baseURL,
      permissions: ["notifications"],
    });
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      page.on("console", (m) => {
        if (m.type() === "error") console.log("[browser]", m.text());
      });
      await page.goto("/login");
      await page.getByPlaceholder("admin@example.com").fill(employee.email);
      await page.getByPlaceholder("••••••••").fill(employee.password);
      await page.getByRole("button", { name: "دخول" }).click();

      // Permission already granted → the panel subscribes on its own.
      await expect(page.getByTestId("alerts-on")).toBeVisible({ timeout: 90_000 });

      // Close the app entirely: delivery must not depend on an open page.
      const other = await context.newPage();
      await page.close();
      await other.goto("/login");

      const product = await createProductViaApi(adminPage, {
        name: "منتج دفع " + Date.now(),
      });

      await expect
        .poll(
          () =>
            other.evaluate(async () => {
              const reg = await navigator.serviceWorker.getRegistration("/");
              return ((await reg?.getNotifications()) ?? []).map((n) => ({
                title: n.title,
                tag: n.tag,
                url: (n.data as { url: string }).url,
              }));
            }),
          { timeout: 60_000, intervals: [500] },
        )
        .toContainEqual({
          title: `منتج جديد: ${product.name}`,
          tag: `new-product-${product.id}`,
          url: `/?q=${product.barcode}`,
        });

      // Logging out unsubscribes this device.
      await other.goto("/");
      await other.getByTitle("تسجيل الخروج").click();
      await other.waitForURL(/\/login/);
      const after = await other.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration("/");
        return (await reg?.pushManager.getSubscription()) ? "subscribed" : "none";
      });
      expect(after).toBe("none");
    } finally {
      await context.close();
      await adminCtx.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test("a notification link (/?q=barcode) opens the table filtered to that product", async ({
    page,
    browser,
  }) => {
    const adminCtx = await browser.newContext({ storageState: "e2e/.auth/state.json" });
    const adminPage = await adminCtx.newPage();
    const employee = await createEmployeeViaApi(adminPage);
    const product = await createProductViaApi(adminPage);
    await createProductViaApi(adminPage);
    await adminCtx.close();

    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(employee.email);
    await page.getByPlaceholder("••••••••").fill(employee.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.getByText("البحث عن منتج").waitFor({ timeout: 15000 });

    await page.goto(`/?q=${product.barcode}`);
    await expect(page.getByTestId("search-input")).toHaveValue(product.barcode);
    await expect(page.getByTestId("product-row")).toHaveCount(1);
    await expect(page.getByTestId("product-row")).toContainText(product.name);
  });
});
