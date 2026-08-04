import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";
import { createProductViaApi } from "./helpers";

/* ------------------------------------------------------------------ */
/* Unauthenticated audits (fresh, independent of the original suite)  */
/* ------------------------------------------------------------------ */

test.describe("fresh 401 audit — no session cookie", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("every mutating endpoint and the export endpoint return 401", async ({
    request,
  }) => {
    const post = await request.post("/api/products", {
      data: { name: "x", purchase_price: 1, sell_price: 1, unit_price: 1, quantity: 1 },
    });
    expect(post.status()).toBe(401);

    const put = await request.put("/api/products/1", {
      data: { name: "x", purchase_price: 1, sell_price: 1, unit_price: 1, quantity: 1 },
    });
    expect(put.status()).toBe(401);

    const del = await request.delete("/api/products/1");
    expect(del.status()).toBe(401);

    const exp = await request.get("/api/products/export");
    expect(exp.status()).toBe(401);

    const list = await request.get("/api/products");
    expect(list.status()).toBe(401);

    const barcode = await request.get("/api/barcode?text=123");
    expect(barcode.status()).toBe(401);
  });

  test("an invalid/expired session cookie redirects cleanly to /login", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: "expired.or.tampered.jwt.value",
        url: baseURL!,
        httpOnly: true,
      },
    ]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("تسجيل الدخول")).toBeVisible();

    const res = await context.request.get("/api/products");
    expect(res.status()).toBe(401);
    await context.close();
  });

  test("CSRF: posting credentials without a CSRF token does not create a session", async ({
    request,
  }) => {
    const csrfProbe = await request.get("/api/auth/csrf");
    expect(csrfProbe.status()).toBe(200);
    expect((await csrfProbe.json()).csrfToken).toBeTruthy();

    // Direct POST with valid credentials but no csrfToken → must not log in.
    const res = await request.post("/api/auth/callback/credentials", {
      form: { email: "admin@e2e.local", password: "E2e@Password123" },
    });
    expect([200, 302, 400, 403]).toContain(res.status());

    const after = await request.get("/api/products");
    expect(after.status()).toBe(401);
  });

  test("brute-force lockout: 5 failures lock the account even for the right password", async ({
    page,
  }) => {
    // Seed a dedicated user so the admin account is never locked by this test.
    const email = "lockout@e2e.local";
    const password = "Correct@Password1";
    const client = createClient({
      url: `file:${path.join(process.cwd(), "e2e.db").replace(/\\/g, "/")}`,
    });
    const db = drizzle(client, { schema });
    await db
      .insert(schema.users)
      .values({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "admin",
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
    client.close();

    await page.goto("/login");
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder("admin@example.com").fill(email);
      await page.getByPlaceholder("••••••••").fill(`wrong-${i}`);
      await page.getByRole("button", { name: "دخول" }).click();
      await expect(page.getByTestId("login-error")).toBeVisible();
    }

    // Correct password now — still refused because the account is locked.
    await page.getByPlaceholder("admin@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

/* ------------------------------------------------------------------ */
/* Authenticated edge cases                                            */
/* ------------------------------------------------------------------ */

test.describe("edge cases (authenticated)", () => {
  test("empty states: no products, no search results, print with nothing selected", async ({
    page,
  }) => {
    // Empty the table through the API.
    const list = await page.request.get("/api/products");
    const { products } = (await list.json()) as {
      products: { id: number }[];
    };
    for (const p of products) {
      await page.request.delete(`/api/products/${p.id}`);
    }

    await page.goto("/");
    await expect(page.getByText("لا توجد منتجات")).toBeVisible();
    await expect(page.getByText("عرض 0 إلى 0 من 0 منتج")).toBeVisible();

    // Print tab with nothing selected: no preview, no print button, no crash.
    await page.getByTestId("tab-print").click();
    await expect(page.getByTestId("print-btn")).toHaveCount(0);
    await expect(page.getByTestId("print-preview")).toHaveCount(0);

    // A search with no results shows the empty state, not an error.
    const product = await createProductViaApi(page);
    await page.goto("/");
    await expect(
      page.getByTestId("product-row").filter({ hasText: product.barcode }),
    ).toBeVisible();
    await page.getByTestId("search-input").fill("نص-لا-يطابق-شيئاً-إطلاقاً");
    await expect(page.getByText("لا توجد منتجات")).toBeVisible();
    await expect(page.getByText("عرض 0 إلى 0 من 0 منتج")).toBeVisible();
  });

  test("rapid presentation-mode scans: 5 back-to-back, final result is correct and never stale", async ({
    page,
  }) => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push(await createProductViaApi(page, { name: `سريع ${i} ${Date.now()}` }));
    }

    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("scan-input")).toBeFocused();

    // Fire all five scans with no waiting between them — the stand-mode case.
    for (const item of items) {
      await page.keyboard.type(item.barcode, { delay: 5 });
      await page.keyboard.press("Enter");
    }

    const last = items[items.length - 1];
    await expect(page.getByTestId("scan-name")).toHaveText(last.name);
    // A slower earlier response must never overwrite the newest result.
    await page.waitForTimeout(800);
    await expect(page.getByTestId("scan-name")).toHaveText(last.name);
    await expect(page.getByTestId("scan-input")).toBeFocused();
  });

  test("each individual scan resolves to its own correct product", async ({
    page,
  }) => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push(await createProductViaApi(page, { name: `تتابع ${i} ${Date.now()}` }));
    }

    await page.goto("/");
    await page.getByTestId("tab-scan").click();

    // Realistic stand pace: one scan every ~300ms; every card must match.
    for (const item of items) {
      await page.keyboard.type(item.barcode, { delay: 5 });
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("scan-name")).toHaveText(item.name, {
        timeout: 3000,
      });
    }
  });

  test("DB/network failure shows a clear error state with retry — never a blank screen", async ({
    page,
  }) => {
    await page.route("**/api/products", (route) => route.abort());
    await page.goto("/");

    await expect(page.getByTestId("load-error")).toBeVisible();
    await expect(
      page.getByText("تعذر تحميل المنتجات — تحقق من الاتصال ثم أعد المحاولة"),
    ).toBeVisible();
    // The shell still renders — not a blank page.
    await expect(page.getByText("البحث عن منتج")).toBeVisible();

    // Connection restored → retry recovers without a reload.
    await page.unroute("**/api/products");
    await page.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(page.getByTestId("load-error")).toHaveCount(0);
  });
});
