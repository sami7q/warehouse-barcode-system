import { BARCODE_SEQUENCE_WIDTH } from "./constants";

/**
 * EAN-13 check digit for a 12-digit payload.
 * 1-indexed odd positions × 1, even positions × 3.
 */
export function computeEan13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error("Expected exactly 12 digits");
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    // 1-indexed odd positions × 1, even positions × 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** True when `code` is 13 digits with a valid EAN-13 check digit. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return computeEan13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/**
 * Assemble the full 13-digit barcode from the 6-digit prefix and the
 * product's autoincrement id (Section 6 of the spec).
 */
export function assembleBarcode(prefix: string, id: number): string {
  if (!/^\d{6}$/.test(prefix)) {
    throw new Error("Barcode prefix must be exactly 6 digits");
  }
  if (!Number.isInteger(id) || id < 0) {
    throw new Error("Product id must be a non-negative integer");
  }
  const sequence = String(id).padStart(BARCODE_SEQUENCE_WIDTH, "0");
  if (sequence.length > BARCODE_SEQUENCE_WIDTH) {
    throw new Error(
      `Product id ${id} exceeds the ${BARCODE_SEQUENCE_WIDTH}-digit sequence capacity`,
    );
  }
  const data12 = prefix + sequence;
  const checkDigit = computeEan13CheckDigit(data12);
  return data12 + String(checkDigit);
}
