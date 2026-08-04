/**
 * Export a real label PDF from the production print route and verify its
 * geometry (print-fix spec §4). Credentials via SMOKE_* env vars.
 * Usage: SMOKE_URL=… SMOKE_EMAIL=… SMOKE_PASSWORD=… PRODUCT_ID=2 \
 *        npx tsx scripts/export-label-pdf.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const URL = process.env.SMOKE_URL!;
const EMAIL = process.env.SMOKE_EMAIL!;
const PASSWORD = process.env.SMOKE_PASSWORD!;
const PRODUCT_ID = process.env.PRODUCT_ID ?? "2";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${URL}/login`);
  await page.getByPlaceholder("admin@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.getByText("البحث عن منتج").waitFor({ timeout: 20000 });

  await page.goto(`${URL}/print/${PRODUCT_ID}`);
  await page.emulateMedia({ media: "print" });
  await page.getByTestId("print-label").waitFor({ timeout: 15000 });

  fs.mkdirSync(path.join(process.cwd(), "docs"), { recursive: true });
  const pdfPath = path.join(process.cwd(), "docs", "label-baseline.pdf");
  const pngPath = path.join(process.cwd(), "docs", "label-baseline.png");

  const pdf = await page.pdf({ preferCSSPageSize: true, path: pdfPath });
  await page.getByTestId("print-label").screenshot({ path: pngPath });

  const raw = pdf.toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw);
  const rotations = [...raw.matchAll(/\/Rotate\s+(-?\d+)/g)]
    .map((m) => Number(m[1]))
    .filter((r) => r % 360 !== 0);
  const wMm = box ? ((Number(box[3]) - Number(box[1])) * 25.4) / 72 : NaN;
  const hMm = box ? ((Number(box[4]) - Number(box[2])) * 25.4) / 72 : NaN;

  const name = await page.locator(".label-name").innerText();
  const digits = await page.locator(".label-digits").innerText();
  const title = await page.title();

  console.log(`pages: ${pages}`);
  console.log(`page size: ${wMm.toFixed(2)}mm x ${hMm.toFixed(2)}mm`);
  console.log(`rotation entries: ${rotations.length ? rotations.join(",") : "none"}`);
  console.log(`name on label: ${name}`);
  console.log(`digits on label: ${digits}`);
  console.log(`document title: ${title}`);
  console.log(`saved: ${pdfPath}, ${pngPath}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
