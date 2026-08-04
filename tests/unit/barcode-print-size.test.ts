import { describe, expect, it } from "vitest";
import { assembleBarcode } from "@/lib/ean13";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { LABEL_WIDTH_MM } from "@/lib/constants";

/**
 * Audit Section 3 — barcode quality at label print size.
 * The label reserves LABEL_WIDTH_MM - 8 mm for the barcode (PrintStyles).
 * EAN-13 is 95 modules wide; the minimum reliably scannable module width
 * (80% magnification of the 0.33mm nominal) is 0.264mm.
 */
const BARCODE_AREA_MM = LABEL_WIDTH_MM - 8;
const EAN13_MODULES = 95;
const MIN_MODULE_MM = 0.264;

describe("EAN-13 rendering at label print size", () => {
  it("module width at the label size stays above the scannable minimum", () => {
    const moduleWidthMm = BARCODE_AREA_MM / EAN13_MODULES;
    expect(moduleWidthMm).toBeGreaterThanOrEqual(MIN_MODULE_MM);
  });

  // bwip-js draws each bar as an "M x 69 L x 0" line command inside <path d="…">.
  const barCount = (svg: string) => (svg.match(/M\d+(\.\d+)? /g) ?? []).length;

  it("renders all 30 EAN-13 bars for small ids (sequence mostly leading zeros)", () => {
    for (const id of [1, 2, 10]) {
      const barcode = assembleBarcode("628110", id);
      const svg = renderBarcodeSvg(barcode, { includeText: false });
      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox");
      // EAN-13 always consists of exactly 30 bars (guards + 12 symbols × 2).
      expect(barCount(svg)).toBe(30);
    }
  });

  it("falls back to Code 128 for 13-digit input with an invalid check digit (no crash)", () => {
    // 9900000000000 has an invalid EAN-13 check digit — must render, not throw.
    const svg = renderBarcodeSvg("9900000000000", { includeText: false });
    expect(svg).toContain("<svg");
    expect(barCount(svg)).toBeGreaterThan(0);
  });

  it("SVG output is identical in structure for min and max sequence ids", () => {
    const small = renderBarcodeSvg(assembleBarcode("628110", 1), {
      includeText: false,
    });
    const large = renderBarcodeSvg(assembleBarcode("628110", 999999), {
      includeText: false,
    });
    expect(barCount(small)).toBe(30);
    expect(barCount(large)).toBe(30);
    // Same canvas dimensions → bars can't clip differently between ids.
    const viewBox = (s: string) => /viewBox="([^"]+)"/.exec(s)?.[1];
    expect(viewBox(small)).toBe(viewBox(large));
  });
});
