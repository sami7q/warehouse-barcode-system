import { expect, test } from "@playwright/test";
import { createProductViaApi, trackConsoleErrors } from "./helpers";

test.describe("main application", () => {
  test("RTL sanity: dir=rtl and Arabic copy renders without mangling", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByText("إدارة المخازن").first()).toBeVisible();
    await expect(page.getByText("البحث عن منتج")).toBeVisible();
    await expect(page.getByText("المستخدم: مدير النظام")).toBeVisible();
    await expect(page.getByTestId("tab-add")).toContainText("إضافة منتج");
    await expect(page.getByTestId("tab-print")).toContainText("طباعة باركود");
    await expect(page.getByTestId("tab-scan")).toContainText("قارئ باركود");
    await expect(page.getByTestId("tab-make")).toContainText("صانع باركود");
    expect(errors).toEqual([]);
  });

  test("live clock ticks in the expected format", async ({ page }) => {
    await page.goto("/");
    const clock = page.getByTestId("live-clock");
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2} [صم]$/, {
      timeout: 5000,
    });
    const first = await clock.textContent();
    await expect
      .poll(async () => clock.textContent(), { timeout: 5000 })
      .not.toBe(first);
  });

  test("add-product flow generates and shows a 13-digit barcode with image", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    const name = `فستق اختبار ${Date.now()}`;
    await page.getByTestId("f-name").fill(name);
    await page.getByTestId("f-buy").fill("45000");
    await page.getByTestId("f-sell").fill("70000");
    await page.getByTestId("f-unit").fill("2000");
    await page.getByTestId("f-qty").fill("120");
    await page.getByTestId("save-btn").click();

    await expect(page.getByTestId("created-panel")).toBeVisible();
    const digits = await page
      .getByTestId("created-barcode-digits")
      .textContent();
    expect(digits).toMatch(/^\d{13}$/);
    await expect(page.getByTestId("created-barcode-svg")).toBeVisible();

    // The new product appears in the table.
    await expect(
      page.getByTestId("product-row").filter({ hasText: name }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("edit and delete a product from the table row actions", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, { quantity: 45 });
    await page.goto("/");

    const row = page
      .getByTestId("product-row")
      .filter({ hasText: product.barcode });
    await expect(row).toBeVisible();

    // Edit: form prefills, save updates the row.
    await row.getByTitle("تعديل").click();
    await expect(page.getByTestId("f-name")).toHaveValue(product.name);
    await page.getByTestId("f-qty").fill("7");
    await expect(page.getByTestId("save-btn")).toHaveText(/تحديث/);
    await page.getByTestId("save-btn").click();
    await expect(row.getByTestId("qty-badge")).toHaveText("7");
    await expect(row.getByTestId("qty-badge")).toHaveAttribute(
      "data-tier",
      "red",
    );

    // Delete with confirmation.
    page.once("dialog", (d) => d.accept());
    await row.getByTitle("حذف").click();
    await expect(row).toHaveCount(0);
  });

  test("quantity badges use the three tiers", async ({ page }) => {
    const red = await createProductViaApi(page, { quantity: 10 });
    const amber = await createProductViaApi(page, { quantity: 45 });
    const green = await createProductViaApi(page, { quantity: 100 });
    await page.goto("/");

    for (const [product, tier] of [
      [red, "red"],
      [amber, "amber"],
      [green, "green"],
    ] as const) {
      const row = page
        .getByTestId("product-row")
        .filter({ hasText: product.barcode });
      await expect(row.getByTestId("qty-badge")).toHaveAttribute(
        "data-tier",
        tier,
      );
    }
  });

  test("search matches by partial name and by exact barcode", async ({
    page,
  }) => {
    const a = await createProductViaApi(page, { name: "خلطة بحث فريدة أ" });
    const b = await createProductViaApi(page, { name: "منتج آخر تماماً" });
    await page.goto("/");

    await page.getByTestId("search-input").fill("بحث فريدة");
    await expect(
      page.getByTestId("product-row").filter({ hasText: a.name }),
    ).toBeVisible();
    await expect(
      page.getByTestId("product-row").filter({ hasText: b.name }),
    ).toHaveCount(0);

    await page.getByTestId("search-input").fill(b.barcode);
    await expect(
      page.getByTestId("product-row").filter({ hasText: b.name }),
    ).toBeVisible();
    await expect(
      page.getByTestId("product-row").filter({ hasText: a.name }),
    ).toHaveCount(0);

    // "تحديث" clears the search and reloads.
    await page.getByTestId("refresh-btn").click();
    await expect(page.getByTestId("search-input")).toHaveValue("");
  });

  test("Excel export triggers an .xlsx download", async ({ page }) => {
    await createProductViaApi(page);
    await page.goto("/");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-btn").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("صانع باركود generates a valid EAN-13 and previews arbitrary text", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-make").click();

    await page.getByTestId("maker-generate").click();
    const value = await page.getByTestId("maker-input").inputValue();
    expect(value).toMatch(/^628110\d{7}$/);
    await expect(page.getByTestId("maker-preview")).toBeVisible();

    await page.getByTestId("maker-input").fill("HELLO-123");
    await expect(page.getByTestId("maker-preview")).toBeVisible();
  });
});
