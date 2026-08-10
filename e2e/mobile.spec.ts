import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./credentials";
import { createProductViaApi } from "./helpers";

const PHONE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13-ish

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("mobile layout (390×844)", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("home screen fits the viewport with no horizontal scroll", async ({
    page,
  }) => {
    await createProductViaApi(page, { name: "منتج جوال" });
    await page.goto("/");
    await expect(page.getByText("البحث عن منتج")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("product table renders as cards, not the desktop grid", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: "بطاقة جوال " + Date.now(),
    });
    await page.goto("/");

    const mobileCard = page
      .getByTestId("product-row-mobile")
      .filter({ hasText: product.barcode });
    const desktopRow = page
      .getByTestId("product-row")
      .filter({ hasText: product.barcode });

    await expect(mobileCard).toBeVisible();
    await expect(desktopRow).toBeHidden();
  });

  test("edit/delete work from a mobile card", async ({ page }) => {
    const product = await createProductViaApi(page, { quantity: 12 });
    await page.goto("/");
    const card = page
      .getByTestId("product-row-mobile")
      .filter({ hasText: product.barcode });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "تعديل" }).click();
    await expect(page.getByTestId("f-name")).toHaveValue(product.name);

    page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "حذف" }).click();
    await expect(card).toHaveCount(0);
  });

  test("all four sidebar tabs are reachable and switch panels", async ({
    page,
  }) => {
    await page.goto("/");
    await assertNoHorizontalOverflow(page);

    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("scan-input")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId("tab-print").click();
    await expect(page.getByText("اختر منتجاً لطباعة ملصق الباركود")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId("tab-make").click();
    await expect(page.getByTestId("maker-input")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId("tab-add").click();
    await expect(page.getByTestId("f-name")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("top bar and bottom bar render without overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("إدارة المخازن").first()).toBeVisible();
    await expect(page.getByTestId("live-clock")).toBeVisible();
    await expect(page.getByText("المستخدم: مدير النظام")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("scanner simulation still works at mobile width", async ({ page }) => {
    const product = await createProductViaApi(page);
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("scan-input")).toBeFocused();
    await page.keyboard.type(product.barcode, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
  });

  test("login page fits the viewport and the remember-me control is tappable", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await assertNoHorizontalOverflow(page);

    const checkbox = page.getByTestId("remember-me");
    const box = await checkbox.boundingBox();
    expect(box).toBeTruthy();

    await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByText("البحث عن منتج")).toBeVisible({
      timeout: 15000,
    });
  });
});
