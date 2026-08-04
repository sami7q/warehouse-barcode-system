import { expect, test } from "@playwright/test";
import { createProductViaApi } from "./helpers";

/**
 * Print-label regression suite (print-fix spec §3). These tests are written
 * to catch the three real-print defects: rotated content, missing product
 * name (clipped by overflow), and wrong page size / stray extra pages.
 */

const MM_TO_PT = 72 / 25.4;
const PAGE_W_PT = 50 * MM_TO_PT; // ≈ 141.73
const PAGE_H_PT = 30 * MM_TO_PT; // ≈ 85.04

/** Parse page count, media boxes, and rotation entries out of a PDF buffer. */
function inspectPdf(pdf: Buffer) {
  const raw = pdf.toString("latin1");
  const pageCount = (raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const mediaBoxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => ({ w: Number(m[3]) - Number(m[1]), h: Number(m[4]) - Number(m[2]) }),
  );
  const rotations = [...raw.matchAll(/\/Rotate\s+(-?\d+)/g)]
    .map((m) => Number(m[1]))
    .filter((r) => r % 360 !== 0);
  return { pageCount, mediaBoxes, rotations };
}

test.describe("print label — PDF geometry", () => {
  test("single label → exactly 1 page at exactly 50mm × 30mm, no rotation", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: "كيلو سكر",
      sell_price: 3000,
    });

    await page.goto(`/print/${product.id}`);
    await page.emulateMedia({ media: "print" });
    await page.getByTestId("print-label").waitFor();
    // Wait for hydration: Next appends its route-announcer div to <body>,
    // which historically re-triggered a trailing blank page — the PDF must be
    // generated with that element present to be representative.
    await page.waitForLoadState("networkidle");

    const pdf = await page.pdf({ preferCSSPageSize: true });
    const { pageCount, mediaBoxes, rotations } = inspectPdf(pdf);

    expect(pageCount).toBe(1);
    for (const box of mediaBoxes) {
      expect(Math.abs(box.w - PAGE_W_PT)).toBeLessThan(1);
      expect(Math.abs(box.h - PAGE_H_PT)).toBeLessThan(1);
    }
    expect(rotations).toEqual([]);
  });

  test("batch of N labels → exactly N pages, no stray blank pages", async ({
    page,
  }) => {
    const a = await createProductViaApi(page);
    const b = await createProductViaApi(page);
    const c = await createProductViaApi(page);

    await page.goto(`/print?ids=${a.id},${b.id},${c.id}`);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("print-label")).toHaveCount(3);
    await page.waitForLoadState("networkidle");

    const pdf = await page.pdf({ preferCSSPageSize: true });
    const { pageCount } = inspectPdf(pdf);
    expect(pageCount).toBe(3);
  });
});

test.describe("print label — content and orientation", () => {
  for (const name of ["كيلو سكر", "خلطة مكسرات فاخرة مشكلة درجة أولى ممتازة"]) {
    test(`product name "${name.slice(0, 12)}…" renders fully inside the label box`, async ({
      page,
    }) => {
      const product = await createProductViaApi(page, { name });

      await page.goto(`/print/${product.id}`);
      await page.emulateMedia({ media: "print" });
      const label = page.getByTestId("print-label");
      await label.waitFor();

      // The exact name text node exists and is visible.
      const nameEl = label.locator(".label-name");
      await expect(nameEl).toBeVisible();
      const domName = (await nameEl.textContent())?.trim();
      expect(domName).toBe(name);

      // The name's box sits fully INSIDE the label box — this is what catches
      // the "clipped off the top by overflow" defect (visible-but-clipped
      // elements still pass toBeVisible()).
      const labelBox = (await label.boundingBox())!;
      const nameBox = (await nameEl.boundingBox())!;
      expect(nameBox.y).toBeGreaterThanOrEqual(labelBox.y - 0.5);
      expect(nameBox.y + nameBox.height).toBeLessThanOrEqual(
        labelBox.y + labelBox.height + 0.5,
      );
      expect(nameBox.x).toBeGreaterThanOrEqual(labelBox.x - 0.5);
      expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(
        labelBox.x + labelBox.width + 0.5,
      );

      // Nothing inside the label overflows its fixed 30mm box.
      const overflow = await label.evaluate((el) => ({
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
      }));
      expect(overflow.scrollH).toBeLessThanOrEqual(overflow.clientH + 1);
      expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1);

      // All four required elements are present.
      await expect(label.locator(".label-barcode")).toBeVisible();
      await expect(label.locator(".label-digits")).toHaveText(product.barcode);
      await expect(label.locator(".label-price")).toContainText("دينار");
    });
  }

  test("no element is rotated and every element uses horizontal-tb writing mode", async ({
    page,
  }) => {
    const product = await createProductViaApi(page, { name: "كيلو سكر" });
    await page.goto(`/print/${product.id}`);
    await page.emulateMedia({ media: "print" });
    await page.getByTestId("print-label").waitFor();

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        if (cs.writingMode !== "horizontal-tb") {
          bad.push(`${el.tagName}: writing-mode=${cs.writingMode}`);
        }
        const t = cs.transform;
        if (t && t !== "none") {
          // Any transform matrix that isn't the identity means rotation/skew.
          const m = t.match(/matrix\(([^)]+)\)/);
          if (m) {
            const [a, b, c, d] = m[1].split(",").map((v) => Number(v.trim()));
            const isIdentity =
              Math.abs(a - 1) < 1e-6 &&
              Math.abs(b) < 1e-6 &&
              Math.abs(c) < 1e-6 &&
              Math.abs(d - 1) < 1e-6;
            if (!isIdentity) bad.push(`${el.tagName}: transform=${t}`);
          } else {
            bad.push(`${el.tagName}: transform=${t}`);
          }
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);

    // The barcode SVG itself carries no rotation attributes either.
    const imgSrc = await page
      .locator(".label-barcode")
      .getAttribute("src");
    const svgMarkup = decodeURIComponent(imgSrc!.replace(/^data:image\/svg\+xml;utf8,/, ""));
    expect(svgMarkup).not.toMatch(/rotate|writing-mode/i);
  });

  test("print route contains no app chrome, header, or branding", async ({
    page,
  }) => {
    const product = await createProductViaApi(page);
    await page.goto(`/print/${product.id}`);
    await page.emulateMedia({ media: "print" });
    await page.getByTestId("print-label").waitFor();

    // innerText = rendered text only (script/style payloads excluded) —
    // this is what can physically appear on the printed label.
    const visibleText = await page.evaluate(() => document.body.innerText);
    expect(visibleText).not.toContain("إدارة المخازن");
    expect(visibleText).not.toContain("المستخدم:");

    // Browsers print the document title in the page header — it must not be
    // the app title either.
    expect(await page.title()).not.toContain("إدارة المخازن");
    await expect(page.locator("nav, header, aside")).toHaveCount(0);
    // Only the four label elements render inside the label.
    const parts = await page
      .getByTestId("print-label")
      .evaluate((el) => Array.from(el.children).map((c) => c.className));
    expect(parts).toEqual([
      "label-name",
      "label-barcode",
      "label-digits",
      "label-price",
    ]);
  });

  test("visual baseline screenshot artifact", async ({ page }, testInfo) => {
    const product = await createProductViaApi(page, {
      name: "كيلو سكر",
      sell_price: 3000,
    });
    await page.goto(`/print/${product.id}`);
    await page.emulateMedia({ media: "print" });
    await page.getByTestId("print-label").waitFor();

    const shot = testInfo.outputPath("label-baseline.png");
    await page.getByTestId("print-label").screenshot({ path: shot });
    await testInfo.attach("label-baseline", {
      path: shot,
      contentType: "image/png",
    });

    const pdfPath = testInfo.outputPath("label-baseline.pdf");
    const pdf = await page.pdf({ preferCSSPageSize: true });
    const fs = await import("node:fs");
    fs.writeFileSync(pdfPath, pdf);
    await testInfo.attach("label-baseline-pdf", {
      path: pdfPath,
      contentType: "application/pdf",
    });
  });
});
