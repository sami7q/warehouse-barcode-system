import { devices, expect, test } from "@playwright/test";
import { createProductViaApi } from "./helpers";

// Only chromium is installed in this environment; keep the device presets'
// viewport/UA/touch shape but stay on chromium rather than pulling in
// webkit just for iOS device emulation (defaultBrowserType would force it).
function deviceOnChromium(name: string) {
  const { defaultBrowserType: _unused, ...rest } = devices[name];
  return rest;
}

/**
 * قارئ الباركود on a REAL mobile device profile (touch, mobile viewport,
 * mobile Chrome UA — not just a desktop browser resized narrow). These
 * target the actual reported failure ("doesn't work on the phone") and the
 * concrete mobile-only causes fixed alongside them:
 *
 *  - Typing on a phone's on-screen keyboard and tapping its Go/Search key
 *    doesn't always fire a clean `key === "Enter"` keydown (a known Android
 *    IME-composition quirk) — the field is now wrapped in a <form> so any
 *    of a real Enter keystroke, a virtual keyboard's action key, or tapping
 *    the visible "بحث" button all submit the same way.
 *  - A barcode is auto-looked-up the moment 13 digits are present, so even
 *    if no Enter/submit ever arrives (e.g. a scanner app that pastes text
 *    with no trailing key event) the lookup still fires.
 *  - The field now hints a numeric keypad (inputMode/pattern) instead of a
 *    full QWERTY layout.
 */
test.describe("قارئ الباركود on a real mobile device profile", () => {
  test.use({ ...deviceOnChromium("iPhone 13") });

  test("tapping to focus, typing, and tapping the بحث button finds the product (no Enter at all)", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: "منتج جوال " + Date.now(),
    });
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();

    const input = page.getByTestId("scan-input");
    await input.tap();
    await input.fill(product.barcode);
    await page.getByTestId("scan-search-btn").tap();

    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
  });

  test("typing a complete 13-digit barcode auto-looks-up without pressing Enter or any button", async ({
    page,
  }) => {
    const product = await createProductViaApi(page);
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();

    const input = page.getByTestId("scan-input");
    await input.tap();
    // .fill() dispatches an input/change event only — deliberately no Enter,
    // no button tap — reproducing a scanner/app that injects text with no
    // trailing key event.
    await input.fill(product.barcode);

    await expect(page.getByTestId("scan-name")).toHaveText(product.name, {
      timeout: 3000,
    });
    await expect(input).toHaveValue("");
  });

  test("an unknown barcode via the بحث button shows the not-found state", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    const input = page.getByTestId("scan-input");
    await input.tap();
    await input.fill("9999999999999");
    await page.getByTestId("scan-search-btn").tap();
    await expect(page.getByTestId("scan-miss")).toBeVisible();
  });

  test("the field hints a numeric keypad instead of a full keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    const input = page.getByTestId("scan-input");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("pattern", "[0-9]*");
  });

  test("an incomplete digit string does not auto-fire", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    const input = page.getByTestId("scan-input");
    await input.tap();
    await input.fill("62811010000"); // 11 digits, one short of EAN-13
    await page.waitForTimeout(500);
    await expect(page.getByTestId("scan-result")).toHaveCount(0);
    await expect(page.getByTestId("scan-miss")).toHaveCount(0);
    await expect(input).toHaveValue("62811010000");
  });

  test("pressing the real Enter key still works on mobile (Bluetooth/physical scanners)", async ({
    page,
  }) => {
    const product = await createProductViaApi(page);
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    const input = page.getByTestId("scan-input");
    await input.tap();
    await page.keyboard.type(product.barcode, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
  });

  test("no horizontal overflow on the scan tab on a real mobile profile", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    await expect(page.getByTestId("scan-input")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});

test.describe("قارئ الباركود on an Android device profile", () => {
  test.use({ ...deviceOnChromium("Pixel 7") });

  test("tap, type, tap بحث finds the product", async ({ page }) => {
    const product = await createProductViaApi(page, {
      name: "اندرويد " + Date.now(),
    });
    await page.goto("/");
    await page.getByTestId("tab-scan").tap();
    const input = page.getByTestId("scan-input");
    await input.tap();
    await input.fill(product.barcode);
    await page.getByTestId("scan-search-btn").tap();
    await expect(page.getByTestId("scan-name")).toHaveText(product.name);
  });
});
