import { describe, expect, it } from "vitest";
import {
  assembleBarcode,
  computeEan13CheckDigit,
  isValidEan13,
} from "@/lib/ean13";

describe("computeEan13CheckDigit", () => {
  it("returns 1 for the verified real-world vector 400638133393", () => {
    // Well-known real EAN-13 check digit, hand-verified (Section 6 of the spec).
    expect(computeEan13CheckDigit("400638133393")).toBe(1);
  });

  it("returns 0 for all zeros", () => {
    expect(computeEan13CheckDigit("000000000000")).toBe(0);
  });

  it("returns 4 for all nines", () => {
    // sum = 6×9×1 + 6×9×3 = 216 → (10 - 6) % 10 = 4
    expect(computeEan13CheckDigit("999999999999")).toBe(4);
  });

  it("rejects input shorter than 12 digits", () => {
    expect(() => computeEan13CheckDigit("12345678901")).toThrow(
      "Expected exactly 12 digits",
    );
  });

  it("rejects input longer than 12 digits", () => {
    expect(() => computeEan13CheckDigit("1234567890123")).toThrow(
      "Expected exactly 12 digits",
    );
  });

  it("rejects non-numeric input", () => {
    expect(() => computeEan13CheckDigit("12345678901a")).toThrow(
      "Expected exactly 12 digits",
    );
    expect(() => computeEan13CheckDigit("")).toThrow(
      "Expected exactly 12 digits",
    );
  });
});

describe("isValidEan13", () => {
  it("accepts a code whose check digit matches", () => {
    expect(isValidEan13("4006381333931")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidEan13("4006381333930")).toBe(false);
  });

  it("rejects non-13-digit input", () => {
    expect(isValidEan13("400638133393")).toBe(false);
    expect(isValidEan13("40063813339311")).toBe(false);
    expect(isValidEan13("400638133393a")).toBe(false);
  });
});

describe("assembleBarcode", () => {
  it("produces exactly 13 numeric digits with a valid check digit", () => {
    for (const id of [1, 7, 42, 999, 123456, 999999]) {
      const code = assembleBarcode("628110", id);
      expect(code).toMatch(/^\d{13}$/);
      expect(isValidEan13(code)).toBe(true);
      expect(code.startsWith("628110")).toBe(true);
      expect(code.slice(6, 12)).toBe(String(id).padStart(6, "0"));
    }
  });

  it("holds for any 6-digit prefix", () => {
    for (const prefix of ["000000", "123456", "999999", "400638"]) {
      const code = assembleBarcode(prefix, 55);
      expect(code).toMatch(/^\d{13}$/);
      expect(isValidEan13(code)).toBe(true);
    }
  });

  it("rejects a prefix that is not exactly 6 digits", () => {
    expect(() => assembleBarcode("62811", 1)).toThrow();
    expect(() => assembleBarcode("6281100", 1)).toThrow();
    expect(() => assembleBarcode("62811a", 1)).toThrow();
  });

  it("rejects an id that exceeds the 6-digit sequence capacity", () => {
    expect(() => assembleBarcode("628110", 1_000_000)).toThrow();
  });

  it("rejects negative or non-integer ids", () => {
    expect(() => assembleBarcode("628110", -1)).toThrow();
    expect(() => assembleBarcode("628110", 1.5)).toThrow();
  });
});
