import { describe, expect, it } from "vitest";
import { productCreateSchema, productUpdateSchema } from "@/lib/validation";

const valid = {
  name: "فستق حلبي",
  purchase_price: 45000,
  sell_price: 70000,
  unit_price: 2000,
  quantity: 120,
};

describe("productCreateSchema", () => {
  it("accepts a valid product", () => {
    const r = productCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(productCreateSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
    expect(
      productCreateSchema.safeParse({ ...valid, name: "   " }).success,
    ).toBe(false);
  });

  it("rejects negative prices and quantity", () => {
    for (const field of [
      "purchase_price",
      "sell_price",
      "unit_price",
      "quantity",
    ] as const) {
      const r = productCreateSchema.safeParse({ ...valid, [field]: -1 });
      expect(r.success).toBe(false);
    }
  });

  it("rejects non-numeric price/quantity input", () => {
    for (const field of [
      "purchase_price",
      "sell_price",
      "unit_price",
      "quantity",
    ] as const) {
      expect(
        productCreateSchema.safeParse({ ...valid, [field]: "abc" }).success,
      ).toBe(false);
      expect(
        productCreateSchema.safeParse({ ...valid, [field]: null }).success,
      ).toBe(false);
    }
  });

  it("rejects non-integer prices", () => {
    expect(
      productCreateSchema.safeParse({ ...valid, sell_price: 10.5 }).success,
    ).toBe(false);
  });

  it("treats an empty barcode as absent (auto-generate)", () => {
    const r = productCreateSchema.safeParse({ ...valid, barcode: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.barcode).toBeUndefined();
  });

  it("accepts a manual numeric barcode and rejects a non-numeric one", () => {
    expect(
      productCreateSchema.safeParse({ ...valid, barcode: "6281101000012" })
        .success,
    ).toBe(true);
    expect(
      productCreateSchema.safeParse({ ...valid, barcode: "abc123" }).success,
    ).toBe(false);
  });
});

describe("productUpdateSchema", () => {
  it("accepts a valid update", () => {
    expect(productUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative quantity", () => {
    expect(
      productUpdateSchema.safeParse({ ...valid, quantity: -5 }).success,
    ).toBe(false);
  });
});
