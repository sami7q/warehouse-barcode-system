import { describe, expect, it } from "vitest";
import type { ApiProduct } from "@/lib/types";
import {
  createdEvent,
  deletedEvent,
  diffProduct,
  eventHeading,
  notificationFor,
  updatedEvent,
} from "@/lib/product-events";

const base: ApiProduct = {
  id: 7,
  barcode: "6281100000075",
  name: "فستق",
  purchasePrice: 45000,
  sellPrice: 70000,
  unitPrice: 2000,
  quantity: 120,
  createdAt: 1000,
  updatedAt: 1000,
};

describe("product events", () => {
  it("diffs only fields an employee sees, formatted for display", () => {
    expect(
      diffProduct(base, { ...base, sellPrice: 75000, quantity: 3, updatedAt: 2000 }),
    ).toEqual([
      { field: "sellPrice", label: "سعر البيع", from: "70,000", to: "75,000", unit: "دينار" },
      { field: "quantity", label: "الكمية", from: "120", to: "3" },
    ]);
    expect(diffProduct(base, { ...base, updatedAt: 9999 })).toEqual([]);
  });

  it("a no-op save is not an event", () => {
    expect(updatedEvent(base, { ...base, updatedAt: 2000 })).toBeNull();
  });

  it("keys are stable per change so push and poll dedupe", () => {
    const after = { ...base, sellPrice: 1, updatedAt: 2000 };
    expect(updatedEvent(base, after)!.key).toBe("u:7:2000");
    expect(updatedEvent(base, after)!.key).toBe(updatedEvent(base, after)!.key);
    expect(createdEvent(base).key).toBe("c:7");
    expect(deletedEvent(base).key).toBe("d:7");
  });

  it("headings: price-only edit vs other edit vs created/deleted", () => {
    expect(eventHeading(updatedEvent(base, { ...base, unitPrice: 1, updatedAt: 2 })!)).toBe(
      "تغيير سعر",
    );
    expect(eventHeading(updatedEvent(base, { ...base, unitPrice: 1, name: "x", updatedAt: 2 })!)).toBe(
      "تعديل منتج",
    );
    expect(eventHeading(createdEvent(base))).toBe("منتج جديد");
    expect(eventHeading(deletedEvent(base))).toBe("حذف منتج");
  });

  it("notification text spells out each change", () => {
    const n = notificationFor(
      updatedEvent(base, { ...base, purchasePrice: 50000, updatedAt: 2000 })!,
    );
    expect(n).toEqual({
      title: "تغيير سعر: فستق",
      body: "سعر الشراء: من 45,000 إلى 50,000 دينار",
      tag: "u:7:2000",
      url: "/?q=6281100000075",
    });
  });

  it("event payloads are plain JSON-safe product rows", () => {
    const withExtra = { ...base, secret: "x" } as ApiProduct;
    expect(Object.keys(createdEvent(withExtra).product)).not.toContain("secret");
  });
});
