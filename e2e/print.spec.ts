import { expect, test } from "@playwright/test";
import { createProductViaApi, trackConsoleErrors } from "./helpers";

declare global {
  interface Window {
    __printCalls?: number;
  }
}

test.describe("طباعة باركود — print flow", () => {
  test.beforeEach(async ({ context }) => {
    // Stub window.print before any page in this context navigates.
    await context.addInitScript(() => {
      window.__printCalls = 0;
      window.print = () => {
        window.__printCalls = (window.__printCalls ?? 0) + 1;
      };
    });
  });

  test("print tab opens /print with the label and calls window.print exactly once", async ({
    page,
    context,
  }) => {
    const product = await createProductViaApi(page, { sell_price: 70000 });

    await page.goto("/");
    await page.getByTestId("tab-print").click();

    const item = page
      .getByTestId("print-item")
      .filter({ hasText: product.barcode });
    await item.getByRole("checkbox").check();
    await expect(page.getByTestId("print-preview")).toBeVisible();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("print-btn").click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(new RegExp(`/print\\?ids=${product.id}`));
    await expect(popup.getByTestId("print-label")).toBeVisible();
    await expect(popup.getByText(product.barcode)).toBeVisible();
    await expect(popup.getByText(product.name)).toBeVisible();

    // window.print is called exactly once, after the SVG has painted.
    await expect
      .poll(async () => popup.evaluate(() => window.__printCalls), {
        timeout: 5000,
      })
      .toBe(1);
    await popup.waitForTimeout(600);
    expect(await popup.evaluate(() => window.__printCalls)).toBe(1);
  });

  test("/print/[id] renders correctly under print media emulation", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const product = await createProductViaApi(page, { sell_price: 12345 });

    await page.goto(`/print/${product.id}`);
    await page.emulateMedia({ media: "print" });

    const label = page.getByTestId("print-label");
    await expect(label).toBeVisible();
    await expect(label).toContainText(product.name);
    await expect(label).toContainText(product.barcode);
    await expect(label).toContainText("دينار");
    await expect(label.locator("img.label-barcode")).toBeVisible();

    await expect
      .poll(async () => page.evaluate(() => window.__printCalls), {
        timeout: 5000,
      })
      .toBe(1);
    expect(errors).toEqual([]);
  });

  test("/print with multiple ids renders one label per product", async ({
    page,
  }) => {
    const a = await createProductViaApi(page);
    const b = await createProductViaApi(page);

    await page.goto(`/print?ids=${a.id},${b.id}`);
    await expect(page.getByTestId("print-label")).toHaveCount(2);
    await expect(page.getByText(a.barcode)).toBeVisible();
    await expect(page.getByText(b.barcode)).toBeVisible();
  });
});
