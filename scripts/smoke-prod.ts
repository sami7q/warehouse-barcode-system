/**
 * Live production smoke test (audit Section 5) — runs against the real
 * deployed URL, not localhost.
 *
 * Usage:
 *   SMOKE_URL=https://… SMOKE_EMAIL=… SMOKE_PASSWORD=… npx tsx scripts/smoke-prod.ts
 *
 * Credentials come only from env vars — they are never printed.
 */
import { chromium } from "@playwright/test";

const URL = process.env.SMOKE_URL;
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

if (!URL || !EMAIL || !PASSWORD) {
  console.error("Set SMOKE_URL, SMOKE_EMAIL, SMOKE_PASSWORD");
  process.exit(2);
}

const results: [string, boolean, string?][] = [];
function record(name: string, ok: boolean, detail?: string) {
  results.push([name, ok, detail]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls++;
    };
  });
  const page = await context.newPage();

  // HTTPS enforcement: http:// must redirect to https://
  const httpUrl = URL!.replace(/^https:/, "http:");
  const httpsProbe = await page.request.get(httpUrl, { maxRedirects: 0 });
  record(
    "HTTPS redirect enforced",
    httpsProbe.status() >= 300 &&
      httpsProbe.status() < 400 &&
      (httpsProbe.headers()["location"] ?? "").startsWith("https://"),
    `status ${httpsProbe.status()}`,
  );

  // Unauthenticated API → 401
  const unauth = await page.request.get(`${URL}/api/products`);
  record("unauthenticated /api/products → 401", unauth.status() === 401);

  // Login
  await page.goto(`${URL}/login`);
  await page.getByPlaceholder("admin@example.com").fill(EMAIL!);
  await page.getByPlaceholder("••••••••").fill(PASSWORD!);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.getByText("البحث عن منتج").waitFor({ timeout: 20000 });
  record("login", true);

  // Add product end-to-end → valid 13-digit barcode
  const name = `منتج فحص الإطلاق ${Date.now()}`;
  await page.getByTestId("f-name").fill(name);
  await page.getByTestId("f-buy").fill("1000");
  await page.getByTestId("f-sell").fill("2000");
  await page.getByTestId("f-unit").fill("100");
  await page.getByTestId("f-qty").fill("50");
  await page.getByTestId("save-btn").click();
  await page.getByTestId("created-panel").waitFor({ timeout: 15000 });
  const digits =
    (await page.getByTestId("created-barcode-digits").textContent())?.trim() ??
    "";
  record("add product generates 13-digit barcode", /^\d{13}$/.test(digits), digits);
  const svgVisible = await page.getByTestId("created-barcode-svg").isVisible();
  record("barcode image rendered", svgVisible);

  // Scanner simulation (keyboard, like a USB HID scanner)
  await page.getByTestId("tab-scan").click();
  await page.keyboard.type(digits, { delay: 15 });
  await page.keyboard.press("Enter");
  await page.getByTestId("scan-result").waitFor({ timeout: 10000 });
  const scanName = (await page.getByTestId("scan-name").textContent()) ?? "";
  record("scanner lookup returns the right product", scanName === name);

  // Print route under print-media emulation
  const row = await page.request.get(
    `${URL}/api/products?barcode=${digits}`,
  );
  const productId = (await row.json()).product.id as number;
  const printPage = await context.newPage();
  await printPage.goto(`${URL}/print/${productId}`);
  await printPage.emulateMedia({ media: "print" });
  await printPage.getByTestId("print-label").waitFor({ timeout: 15000 });
  const labelText = (await printPage.getByTestId("print-label").textContent()) ?? "";
  record(
    "print route renders label under print emulation",
    labelText.includes(name) && labelText.includes(digits),
  );
  await printPage.waitForTimeout(700);
  const calls = await printPage.evaluate(
    () => (window as unknown as { __printCalls: number }).__printCalls,
  );
  record("window.print auto-called exactly once", calls === 1, String(calls));
  await printPage.close();

  // Excel export
  const exportRes = await page.request.get(`${URL}/api/products/export`);
  const contentType = exportRes.headers()["content-type"] ?? "";
  record(
    "Excel export downloads .xlsx",
    exportRes.status() === 200 && contentType.includes("spreadsheetml"),
  );

  // Cleanup the smoke product
  const del = await page.request.delete(`${URL}/api/products/${productId}`);
  record("cleanup: smoke product deleted", del.status() === 200);

  await browser.close();

  const failed = results.filter(([, ok]) => !ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} smoke checks passed`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
