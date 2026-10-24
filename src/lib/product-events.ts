import type { ApiProduct } from "./types";
import { fmtNumber } from "./format";

/**
 * Product events the employees are notified about — shared by the server
 * (Web Push payload, src/lib/push.ts) and the browser (in-app cards, both
 * from the poll and from the service worker), so both describe a change
 * the same way and agree on its dedupe key.
 */

export type ProductChange = {
  field: keyof ApiProduct;
  label: string;
  from: string;
  to: string;
  unit?: string;
};

export type ProductEvent = {
  kind: "created" | "updated" | "deleted";
  /** Same event → same key, whichever path (push or poll) saw it first. */
  key: string;
  /** State after the change (created/updated) or before it (deleted). */
  product: ApiProduct;
  changes: ProductChange[];
};

const PRICE_FIELDS = new Set<keyof ApiProduct>([
  "purchasePrice",
  "sellPrice",
  "unitPrice",
]);

const TRACKED: {
  field: keyof ApiProduct;
  label: string;
  format: (v: ApiProduct[keyof ApiProduct]) => string;
  unit?: string;
}[] = [
  { field: "name", label: "اسم المنتج", format: String },
  { field: "barcode", label: "الباركود", format: String },
  { field: "purchasePrice", label: "سعر الشراء", format: (v) => fmtNumber(Number(v)), unit: "دينار" },
  { field: "sellPrice", label: "سعر البيع", format: (v) => fmtNumber(Number(v)), unit: "دينار" },
  { field: "unitPrice", label: "سعر المفرد", format: (v) => fmtNumber(Number(v)), unit: "دينار" },
  { field: "quantity", label: "الكمية", format: String },
];

/** Field-by-field differences an employee cares about (not timestamps). */
export function diffProduct(before: ApiProduct, after: ApiProduct): ProductChange[] {
  return TRACKED.filter((t) => before[t.field] !== after[t.field]).map((t) => ({
    field: t.field,
    label: t.label,
    from: t.format(before[t.field]),
    to: t.format(after[t.field]),
    ...(t.unit ? { unit: t.unit } : {}),
  }));
}

/** Plain row: drizzle returns extra-typed objects, the push payload must be JSON. */
function pick(p: ApiProduct): ApiProduct {
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    purchasePrice: p.purchasePrice,
    sellPrice: p.sellPrice,
    unitPrice: p.unitPrice,
    quantity: p.quantity,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function createdEvent(p: ApiProduct): ProductEvent {
  return { kind: "created", key: `c:${p.id}`, product: pick(p), changes: [] };
}

/** null when nothing an employee would see changed (e.g. a no-op save). */
export function updatedEvent(before: ApiProduct, after: ApiProduct): ProductEvent | null {
  const changes = diffProduct(before, after);
  if (changes.length === 0) return null;
  return {
    kind: "updated",
    key: `u:${after.id}:${after.updatedAt}`,
    product: pick(after),
    changes,
  };
}

export function deletedEvent(p: ApiProduct): ProductEvent {
  return { kind: "deleted", key: `d:${p.id}`, product: pick(p), changes: [] };
}

export function isPriceOnly(e: ProductEvent): boolean {
  return e.kind === "updated" && e.changes.every((c) => PRICE_FIELDS.has(c.field));
}

export function changeLine(c: ProductChange): string {
  const unit = c.unit ? ` ${c.unit}` : "";
  return `${c.label}: من ${c.from} إلى ${c.to}${unit}`;
}

/** Heading for the in-app card and the system notification. */
export function eventHeading(e: ProductEvent): string {
  if (e.kind === "created") return "منتج جديد";
  if (e.kind === "deleted") return "حذف منتج";
  return isPriceOnly(e) ? "تغيير سعر" : "تعديل منتج";
}

/** System-notification text (public/sw.js shows it as-is). */
export function notificationFor(e: ProductEvent): {
  title: string;
  body: string;
  tag: string;
  url: string;
} {
  const p = e.product;
  const lines =
    e.kind === "updated"
      ? e.changes.map(changeLine)
      : e.kind === "deleted"
        ? [`الباركود: ${p.barcode}`, "تم حذفه من النظام"]
        : [
            `الباركود: ${p.barcode}`,
            `سعر البيع: ${fmtNumber(p.sellPrice)} دينار · سعر المفرد: ${fmtNumber(p.unitPrice)} دينار · الكمية: ${p.quantity}`,
          ];
  return {
    title: `${eventHeading(e)}: ${p.name}`,
    body: lines.join("\n"),
    tag: e.key,
    url: e.kind === "deleted" ? "/" : `/?q=${encodeURIComponent(p.barcode)}`,
  };
}
