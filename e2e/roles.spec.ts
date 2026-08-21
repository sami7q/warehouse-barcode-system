import { expect, test } from "@playwright/test";
import { createEmployeeViaApi, createProductViaApi } from "./helpers";

test.describe("admin — إدارة الموظفين tab", () => {
  test("create, list, and delete an employee account", async ({ page }) => {
    const email = `emp-crud-${Date.now()}@e2e.local`;
    await page.goto("/");
    await page.getByTestId("tab-employees").click();

    await page.getByTestId("employee-email").fill(email);
    await page.getByTestId("employee-password").fill("Password123");
    await page.getByTestId("employee-create-btn").click();

    const row = page.getByTestId("employee-row").filter({ hasText: email });
    await expect(row).toBeVisible();

    await page.once("dialog", (d) => d.accept());
    await row.getByTitle("حذف").click();
    await expect(row).toHaveCount(0);
  });

  test("rejects a short password with a clear error", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-employees").click();
    await page.getByTestId("employee-email").fill(`short-${Date.now()}@e2e.local`);
    await page.getByTestId("employee-password").fill("123");
    await page.getByTestId("employee-create-btn").click();
    await expect(page.getByTestId("employee-form-error")).toContainText(
      "8 أحرف",
    );
  });

  test("rejects creating a duplicate email", async ({ page }) => {
    const email = `emp-dup-${Date.now()}@e2e.local`;
    await page.goto("/");
    await page.getByTestId("tab-employees").click();
    await page.getByTestId("employee-email").fill(email);
    await page.getByTestId("employee-password").fill("Password123");
    await page.getByTestId("employee-create-btn").click();
    await expect(
      page.getByTestId("employee-row").filter({ hasText: email }),
    ).toBeVisible();

    await page.getByTestId("employee-email").fill(email);
    await page.getByTestId("employee-password").fill("Password456");
    await page.getByTestId("employee-create-btn").click();
    await expect(page.getByTestId("employee-form-error")).toContainText(
      "مستخدم بالفعل",
    );
  });

  test("employees tab is admin-only in the UI", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tab-employees")).toBeVisible();
  });
});

test.describe("employee session — read-only view", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  async function loginAsFreshEmployee(page: import("@playwright/test").Page, adminPage: import("@playwright/test").Page) {
    const employee = await createEmployeeViaApi(adminPage);
    await page.goto("/login");
    await page.getByPlaceholder("admin@example.com").fill(employee.email);
    await page.getByPlaceholder("••••••••").fill(employee.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.getByText("البحث عن منتج").waitFor({ timeout: 15000 });
    return employee;
  }

  test("shows the full product table but no edit/delete, no other tabs, no export", async ({
    page,
    browser,
  }) => {
    // Use a throwaway admin-authenticated context just to create fixtures.
    const adminCtx = await browser.newContext({
      storageState: "e2e/.auth/state.json",
    });
    const adminPage = await adminCtx.newPage();
    const product = await createProductViaApi(adminPage, {
      name: "منتج موظف " + Date.now(),
      quantity: 42,
    });
    await loginAsFreshEmployee(page, adminPage);
    await adminCtx.close();

    // Full data visible.
    const row = page
      .getByTestId("product-row")
      .filter({ hasText: product.barcode });
    await expect(row).toBeVisible();
    await expect(row).toContainText(product.name);
    await expect(row.getByTestId("qty-badge")).toHaveText("42");

    // No mutation controls anywhere in the table.
    await expect(row.getByTitle("تعديل")).toHaveCount(0);
    await expect(row.getByTitle("حذف")).toHaveCount(0);

    // No export button, no other sidebar tabs — only the scan panel.
    await expect(page.getByTestId("export-btn")).toHaveCount(0);
    await expect(page.getByTestId("tab-add")).toHaveCount(0);
    await expect(page.getByTestId("tab-print")).toHaveCount(0);
    await expect(page.getByTestId("tab-make")).toHaveCount(0);
    await expect(page.getByTestId("tab-employees")).toHaveCount(0);
    await expect(page.getByTestId("scan-input")).toBeVisible();
    await expect(page.getByTestId("camera-scan-btn")).toBeVisible();

    // Bottom bar correctly labels the session as an employee, not admin.
    await expect(page.getByText("المستخدم: موظف")).toBeVisible();
  });

  test("search still works read-only, and the scanner still finds products", async ({
    page,
    browser,
  }) => {
    const adminCtx = await browser.newContext({
      storageState: "e2e/.auth/state.json",
    });
    const adminPage = await adminCtx.newPage();
    const product = await createProductViaApi(adminPage, {
      name: "بحث موظف فريد " + Date.now(),
    });
    await loginAsFreshEmployee(page, adminPage);
    await adminCtx.close();

    await page.getByTestId("search-input").fill(product.barcode);
    await expect(
      page.getByTestId("product-row").filter({ hasText: product.name }),
    ).toBeVisible();

    // No tabs to switch on the employee view — the scan panel is always
    // the whole sidebar.
    const scanInput = page.getByTestId("scan-input");
    await scanInput.click();
    await page.keyboard.type(product.barcode, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
  });

  test("clicking the main search bar is not hijacked back to قارئ الباركود", async ({
    page,
    browser,
  }) => {
    // Regression: the scan field auto-focuses on mount and used to steal
    // focus back unconditionally on ANY blur — including when the employee
    // deliberately clicked the main search bar, which sits right next to
    // the always-mounted scan panel on this view (no tab to switch away
    // from it, unlike the admin sidebar).
    const adminCtx = await browser.newContext({
      storageState: "e2e/.auth/state.json",
    });
    const adminPage = await adminCtx.newPage();
    const product = await createProductViaApi(adminPage, {
      name: "بحث بدون تحويل " + Date.now(),
    });
    await loginAsFreshEmployee(page, adminPage);
    await adminCtx.close();

    // The scan input auto-focuses itself on page load — confirm that,
    // then click into the main search bar instead.
    await expect(page.getByTestId("scan-input")).toBeFocused();
    const searchInput = page.getByTestId("search-input");
    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await page.keyboard.type(product.name, { delay: 15 });

    // Focus must still be on the search bar, not yanked back to the scanner.
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue(product.name);
    // And typing there must not have landed in / triggered the scanner.
    await expect(page.getByTestId("scan-input")).toHaveValue("");
    await expect(page.getByTestId("scan-result")).toHaveCount(0);
    await expect(page.getByTestId("scan-miss")).toHaveCount(0);

    await expect(
      page.getByTestId("product-row").filter({ hasText: product.name }),
    ).toBeVisible();
  });

  test("server-side: every mutating product/user endpoint returns 403 for the employee session", async ({
    page,
    browser,
  }) => {
    const adminCtx = await browser.newContext({
      storageState: "e2e/.auth/state.json",
    });
    const adminPage = await adminCtx.newPage();
    const product = await createProductViaApi(adminPage);
    await loginAsFreshEmployee(page, adminPage);
    await adminCtx.close();

    const post = await page.request.post("/api/products", {
      data: {
        name: "x",
        purchase_price: 1,
        sell_price: 1,
        unit_price: 1,
        quantity: 1,
      },
    });
    expect(post.status()).toBe(403);

    const put = await page.request.put(`/api/products/${product.id}`, {
      data: {
        name: "تعديل ممنوع",
        purchase_price: 1,
        sell_price: 1,
        unit_price: 1,
        quantity: 1,
      },
    });
    expect(put.status()).toBe(403);

    const del = await page.request.delete(`/api/products/${product.id}`);
    expect(del.status()).toBe(403);

    const exp = await page.request.get("/api/products/export");
    expect(exp.status()).toBe(403);

    const usersGet = await page.request.get("/api/users");
    expect(usersGet.status()).toBe(403);

    const usersPost = await page.request.post("/api/users", {
      data: { email: "hacker@e2e.local", password: "Password123" },
    });
    expect(usersPost.status()).toBe(403);

    // Non-mutating reads remain allowed.
    const list = await page.request.get("/api/products");
    expect(list.status()).toBe(200);
    const barcode = await page.request.get(
      `/api/barcode?text=${product.barcode}`,
    );
    expect(barcode.status()).toBe(200);

    // The product was genuinely untouched.
    const check = await page.request.get(
      `/api/products?barcode=${product.barcode}`,
    );
    const data = await check.json();
    expect(data.product.name).toBe(product.name);
  });

  test("no horizontal overflow on the employee view at a mobile viewport", async ({
    page,
    browser,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const adminCtx = await browser.newContext({
      storageState: "e2e/.auth/state.json",
    });
    const adminPage = await adminCtx.newPage();
    await createProductViaApi(adminPage);
    await loginAsFreshEmployee(page, adminPage);
    await adminCtx.close();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
