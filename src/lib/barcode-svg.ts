import bwipjs from "bwip-js/node";
import { isValidEan13 } from "./ean13";

/**
 * Render a barcode as an SVG string with bwip-js (pure JS — serverless-safe).
 * Uses EAN-13 for 13-digit numeric input, Code 128 for anything else
 * (the "صانع باركود" utility accepts arbitrary text).
 */
export function renderBarcodeSvg(
  text: string,
  opts?: { bcid?: string; includeText?: boolean },
): string {
  // EAN-13 only for a *valid* EAN-13 (bwip-js rejects bad check digits with a
  // throw, which would 500 the print route for manually-entered barcodes);
  // anything else renders as Code 128, which accepts arbitrary text.
  const symbology = opts?.bcid ?? (isValidEan13(text) ? "ean13" : "code128");
  return bwipjs.toSVG({
    bcid: symbology,
    text,
    height: 12,
    includetext: opts?.includeText ?? true,
    textxalign: "center",
  });
}
