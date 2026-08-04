import { expect, test } from "@playwright/test";
import { createProductViaApi, trackConsoleErrors } from "./helpers";

/**
 * Scanner simulation (Section 11.3): a USB barcode scanner is a HID keyboard —
 * it types the digits in a few ms and ends with Enter. page.keyboard.type with
 * a small delay reproduces exactly the input the browser would receive.
 */
test.describe("قارئ باركود — scanner simulation", () => {
  test("scanning a known barcode shows the product card instantly", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const product = await createProductViaApi(page, {
      quantity: 33,
      sell_price: 70000,
    });

    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("scan-input")).toBeFocused();

    // Keystroke-for-keystroke what a real USB HID scanner sends.
    await page.keyboard.type(product.barcode, { delay: 15 });
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("scan-result")).toBeVisible();
    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
    await expect(page.getByTestId("scan-result")).toContainText("33");

    // Input clears and refocuses, ready for the next scan.
    await expect(page.getByTestId("scan-input")).toHaveValue("");
    await expect(page.getByTestId("scan-input")).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("scanning an unknown barcode shows the not-found state", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("scan-input")).toBeFocused();

    await page.keyboard.type("9999999999999", { delay: 15 });
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("scan-miss")).toBeVisible();
    await expect(page.getByTestId("scan-miss")).toHaveText(
      "لا يوجد منتج بهذا الباركود",
    );
    await expect(page.getByTestId("scan-input")).toHaveValue("");
    await expect(page.getByTestId("scan-input")).toBeFocused();
  });

  test("a second scan immediately after the first works (auto-refocus)", async ({
    page,
  }) => {
    const first = await createProductViaApi(page);
    const second = await createProductViaApi(page);

    await page.goto("/");
    await page.getByTestId("tab-scan").click();

    await page.keyboard.type(first.barcode, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scan-name")).toHaveText(first.name);

    await page.keyboard.type(second.barcode, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scan-name")).toHaveText(second.name);
  });
});
