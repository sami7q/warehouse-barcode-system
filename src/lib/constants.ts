/** Quantity badge tiers (Section 3 of the spec) — adjust here only. */
export const QTY_RED_BELOW = 30; // quantity < 30 → red
export const QTY_AMBER_BELOW = 60; // 30–59 → amber, >= 60 → green

export const QTY_COLORS = {
  red: "#DC2626",
  amber: "#EA8C00",
  green: "#16A34A",
} as const;

export type QtyTier = keyof typeof QTY_COLORS;

export function qtyTier(quantity: number): QtyTier {
  if (quantity < QTY_RED_BELOW) return "red";
  if (quantity < QTY_AMBER_BELOW) return "amber";
  return "green";
}

/** Label size for the thermal printer (Section 7) — change here only. */
export const LABEL_WIDTH_MM = 50;
export const LABEL_HEIGHT_MM = 30;
/**
 * Barcode image height on the label. The full content stack (name + barcode +
 * digits + price + gaps + padding) must total well under LABEL_HEIGHT_MM —
 * overflowing the box clips the product name and can force a second page.
 */
export const LABEL_BARCODE_HEIGHT_MM = 11;

/** Delay before window.print() so barcode SVGs have painted. */
export const PRINT_DELAY_MS = 300;

/** Default EAN-13 company prefix (6 digits). Overridable via env. */
export const DEFAULT_BARCODE_PREFIX = "628110";

export function getBarcodePrefix(): string {
  const prefix = process.env.BARCODE_PREFIX || DEFAULT_BARCODE_PREFIX;
  if (!/^\d{6}$/.test(prefix)) {
    throw new Error("BARCODE_PREFIX must be exactly 6 digits");
  }
  return prefix;
}

/** Width of the numeric sequence portion of the barcode (6 → max 999,999 products). */
export const BARCODE_SEQUENCE_WIDTH = 6;

/**
 * "تذكرني" (remember me) session length on the login form. Unchecked keeps a
 * short session appropriate for a shared shop PC; checked keeps the owner
 * logged in for a month. Both are enforced via the JWT's own exp claim
 * (see src/auth.ts), not just the cookie's physical lifetime.
 */
export const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

export function resolveSessionMaxAge(remember: boolean): number {
  return remember ? REMEMBER_ME_MAX_AGE_SECONDS : DEFAULT_SESSION_MAX_AGE_SECONDS;
}
