import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { createClient } from "@libsql/client";
import { createEmployeeViaApi, createProductViaApi } from "./helpers";

/**
 * Set PUSH_E2E_REAL=1 to also wait for the genuine push from Google FCM
 * (server → web-push → FCM → browser). It's left opt-in because FCM's
 * delivery to a throwaway headless profile is intermittent — the server
 * side of that hop is covered by tests/integration/push.test.ts.
 */
const REAL_FCM = process.env.PUSH_E2E_REAL === "1";

/** Hand a push to the real service worker the way the browser's push
 * service would, via the DevTools protocol. */
async function deliverPush(page: Page, data: unknown) {
  const cdp = await page.context().newCDPSession(page);
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const reg = registrations.find((r) => !r.isDeleted);
      if (reg) resolve(reg.registrationId);
    });
    void cdp.send("ServiceWorker.enable");
  });
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(page.url()).origin,
    registrationId,
    data: JSON.stringify(data),
  });
}

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

  test("employee device subscribes, and a pushed product shows as a notification with the app closed", async ({
    browser,
    baseURL,
  }) => {
    // A fresh profile's first FCM registration alone can take ~30s.
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
      const endpoint = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.pushManager.getSubscription())?.endpoint ?? "";
      });
      expect(endpoint).toMatch(/^https:\/\//);

      // The real browser subscription is stored server-side for this employee.
      const db = createClient({
        url: `file:${path.join(process.cwd(), "e2e.db").replace(/\\/g, "/")}`,
      });
      const rows = await db.execute({
        sql: "select u.email from push_subscriptions s join users u on u.id = s.user_id where s.endpoint = ?",
        args: [endpoint],
      });
      db.close();
      expect(rows.rows.map((r) => r.email)).toEqual([employee.email]);

      // Close the app entirely: delivery must not depend on an open page.
      const other = await context.newPage();
      await page.close();
      await other.goto("/login");

      const product = await createProductViaApi(adminPage, {
        name: "منتج دفع " + Date.now(),
      });
      const expected = {
        title: `منتج جديد: ${product.name}`,
        tag: `new-product-${product.id}`,
        url: `/?q=${product.barcode}`,
      };
      const shown = () =>
        other.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration("/");
          return ((await reg?.getNotifications()) ?? []).map((n) => ({
            title: n.title,
            tag: n.tag,
            url: (n.data as { url: string }).url,
          }));
        });
      if (REAL_FCM) {
        await expect
          .poll(shown, { timeout: 60_000, intervals: [500] })
          .toContainEqual(expected);
      } else {
        // The DevTools hand-off is occasionally dropped; re-deliver rather
        // than fail (a duplicate shares the tag, so it just replaces).
        await expect(async () => {
          await deliverPush(other, { ...expected, body: `الباركود: ${product.barcode}` });
          await expect
            .poll(shown, { timeout: 10_000, intervals: [500] })
            .toContainEqual(expected);
        }).toPass({ timeout: 60_000 });
      }

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
