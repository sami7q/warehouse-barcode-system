import type { Page } from "@playwright/test";

/**
 * Collect real console errors, ignoring expected 404 resource logs
 * (unknown-barcode lookups intentionally return 404).
 */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("Failed to load resource") &&
      text.includes("404")
    ) {
      return;
    }
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    errors.push(String(err));
  });
  return errors;
}

let counter = 0;

/** Create a product through the authenticated API; returns the product row. */
export async function createProductViaApi(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  counter += 1;
  const res = await page.request.post("/api/products", {
    data: {
      name: `منتج اختبار ${Date.now()}-${counter}`,
      purchase_price: 1000,
      sell_price: 2000,
      unit_price: 100,
      quantity: 50,
      ...overrides,
    },
  });
  if (!res.ok()) {
    throw new Error(`createProductViaApi failed: ${res.status()}`);
  }
  const data = (await res.json()) as {
    product: { id: number; barcode: string; name: string; sellPrice: number };
  };
  return data.product;
}
