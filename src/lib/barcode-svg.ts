import bwipjs from "bwip-js/node";

/**
 * Render a barcode as an SVG string with bwip-js (pure JS — serverless-safe).
 * Uses EAN-13 for 13-digit numeric input, Code 128 for anything else
 * (the "صانع باركود" utility accepts arbitrary text).
 */
export function renderBarcodeSvg(
  text: string,
  opts?: { bcid?: string; includeText?: boolean },
): string {
  const symbology =
    opts?.bcid ?? (/^\d{13}$/.test(text) ? "ean13" : "code128");
  return bwipjs.toSVG({
    bcid: symbology,
    text,
    height: 12,
    includetext: opts?.includeText ?? true,
    textxalign: "center",
  });
}
