import { expect, test, type Page } from "@playwright/test";
import { createEmployeeViaApi, createProductViaApi } from "./helpers";

/**
 * Camera barcode scanning (ZXing, browser-side decode). There is no way to
 * point a real camera at a real product label in CI, so these tests use the
 * browser's own APIs to build the strongest possible substitute: a canvas
 * with a REAL barcode image (rendered by our own /api/barcode endpoint,
 * decoded by the app's REAL bundled @zxing/browser code — nothing here is
 * mocked except the camera hardware itself) turned into a MediaStream via
 * `canvas.captureStream()`, returned in place of a real getUserMedia stream.
 * This exercises the entire feature end to end: permission → live stream →
 * ZXing decode → onDetect → lookup() → product card — not just the UI shell.
 */

async function mockCameraWithBarcode(page: Page, svgMarkup: string) {
  await page.addInitScript((svg) => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as unknown as { __trackStops: number }).__trackStops = 0;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints || !constraints.video) return original(constraints);

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("barcode image failed to load"));
        img.src = url;
      });
      ctx.drawImage(img, 60, 110, 520, 100);
      URL.revokeObjectURL(url);

      const stream = canvas.captureStream(15);
      for (const track of stream.getTracks()) {
        const originalStop = track.stop.bind(track);
        track.stop = () => {
          (window as unknown as { __trackStops: number }).__trackStops += 1;
          originalStop();
        };
      }
      return stream;
    };
  }, svgMarkup);
}

/**
 * A "live" camera stream that never contains a decodable barcode — used for
 * the cancel/cleanup tests, where a real barcode image (as used above)
 * decodes so fast against a static synthetic frame that the modal can close
 * itself before the test gets a chance to interact with it.
 */
async function mockCameraBlank(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __trackStops: number }).__trackStops = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const stream = canvas.captureStream(15);
      for (const track of stream.getTracks()) {
        const originalStop = track.stop.bind(track);
        track.stop = () => {
          (window as unknown as { __trackStops: number }).__trackStops += 1;
          originalStop();
        };
      }
      return stream;
    };
  });
}

async function mockCameraRejected(page: Page, errorName: string) {
  await page.addInitScript((name) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const err = new DOMException("denied", name);
      throw err;
    };
  }, errorName);
}

test.describe("camera barcode scanning", () => {
  test("scanning a real barcode via the (mocked) camera finds the product — full pipeline", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: "منتج كاميرا " + Date.now(),
    });
    const svgRes = await page.request.get(
      `/api/barcode?text=${product.barcode}`,
    );
    expect(svgRes.ok()).toBe(true);
    const svg = await svgRes.text();

    await mockCameraWithBarcode(page, svg);
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await page.getByTestId("camera-scan-btn").click();

    // The full pipeline: permission → stream → real ZXing decode of a real
    // barcode image → onDetect → lookup() → product card. No intermediate
    // "modal visible" check here — decode against a static synthetic frame
    // completes fast enough that the modal can already be closed again by
    // the time the very next assertion runs; the meaningful, non-racy proof
    // is the end state below.
    await expect(page.getByTestId("scan-name")).toHaveText(product.name, {
      timeout: 15000,
    });
    // Modal closes itself the moment a code is detected.
    await expect(page.getByTestId("camera-scan-modal")).toHaveCount(0);
  });

  test("permission denied shows a clear error, no crash", async ({ page }) => {
    await mockCameraRejected(page, "NotAllowedError");
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await page.getByTestId("camera-scan-btn").click();

    await expect(page.getByTestId("camera-scan-error")).toContainText(
      "رفض إذن الوصول",
    );
    // The modal is still usable — cancel works normally after an error.
    await page.getByTestId("camera-scan-cancel").click();
    await expect(page.getByTestId("camera-scan-modal")).toHaveCount(0);
  });

  test("no camera found shows a clear error", async ({ page }) => {
    await mockCameraRejected(page, "NotFoundError");
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await page.getByTestId("camera-scan-btn").click();
    await expect(page.getByTestId("camera-scan-error")).toContainText(
      "لم يتم العثور على كاميرا",
    );
  });

  test("cancel button stops the camera stream (no leaked track)", async ({
    page,
  }) => {
    // A stream that never resolves to a barcode, so the modal stays open
    // long enough to click cancel (a real decodable image can complete in
    // well under one polling interval against a static synthetic frame).
    await mockCameraBlank(page);

    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await page.getByTestId("camera-scan-btn").click();
    await expect(page.getByTestId("camera-scan-video")).toBeVisible();

    await page.getByTestId("camera-scan-cancel").click();
    await expect(page.getByTestId("camera-scan-modal")).toHaveCount(0);

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __trackStops: number }).__trackStops,
        ),
      )
      .toBeGreaterThan(0);

    // The scan tab is still fully usable afterwards (no stuck state).
    await expect(page.getByTestId("scan-input")).toBeVisible();
  });

  test("the camera modal is a true blocking overlay — no other tab is reachable until it's closed", async ({
    page,
  }) => {
    // This also covers the "component unmounted while scanning" cleanup
    // case: since the modal genuinely blocks all other interaction, the
    // only way to leave the camera view is the cancel button (already
    // covered above) or navigating away entirely, which the browser itself
    // tears the media stream down for regardless of our own cleanup code.
    await mockCameraBlank(page);

    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await page.getByTestId("camera-scan-btn").click();
    await expect(page.getByTestId("camera-scan-video")).toBeVisible();

    await expect(
      page.getByTestId("tab-add").click({ timeout: 1000 }),
    ).rejects.toThrow();

    // Cancel still works normally afterwards — the app isn't stuck.
    await page.getByTestId("camera-scan-cancel").click();
    await expect(page.getByTestId("camera-scan-modal")).toHaveCount(0);
    await page.getByTestId("tab-add").click();
    await expect(page.getByTestId("f-name")).toBeVisible();
  });

  test("the camera button is present for both the admin and the employee scan panel", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.getByTestId("tab-scan").click();
    await expect(page.getByTestId("camera-scan-btn")).toBeVisible();

    const employee = await createEmployeeViaApi(page);
    const empCtx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const empPage = await empCtx.newPage();
    await empPage.goto("/login");
    await empPage.getByPlaceholder("admin@example.com").fill(employee.email);
    await empPage.getByPlaceholder("••••••••").fill(employee.password);
    await empPage.getByRole("button", { name: "دخول" }).click();
    await empPage.getByText("البحث عن منتج").waitFor({ timeout: 15000 });

    await expect(empPage.getByTestId("camera-scan-btn")).toBeVisible();
    await empCtx.close();
  });
});
