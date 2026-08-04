import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";

/**
 * Audit Section 4 — performance with ~500 products and a 20-label batch
 * print. Named zz- so it runs last and its bulk data doesn't affect the
 * other specs. Timings are logged for the audit report.
 */

const SEED_COUNT = 500;
let seededIds: number[] = [];

test.describe("performance with 500 products", () => {
  test.beforeAll(async () => {
    const client = createClient({
      url: `file:${path.join(process.cwd(), "e2e.db").replace(/\\/g, "/")}`,
    });
    const db = drizzle(client, { schema });
    const now = Date.now();
    const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
      barcode: String(9900000000000 + i),
      name: `منتج أداء ${i}`,
      purchasePrice: 1000 + i,
      sellPrice: 2000 + i,
      unitPrice: 100,
      quantity: i % 120,
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    }));
    // Chunked bulk insert (SQLite parameter limits).
    const inserted: { id: number }[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const batch = await db
        .insert(schema.products)
        .values(rows.slice(i, i + 50))
        .returning({ id: schema.products.id });
      inserted.push(...batch);
    }
    seededIds = inserted.map((r) => r.id);
    client.close();
    expect(seededIds.length).toBe(SEED_COUNT);
  });

  test("table loads responsively and search stays fast with 500 products", async ({
    page,
  }) => {
    const t0 = Date.now();
    await page.goto("/");
    await expect(page.getByTestId("product-row").first()).toBeVisible();
    const loadMs = Date.now() - t0;
    console.log(`[perf] initial load with ${SEED_COUNT}+ products: ${loadMs}ms`);
    expect(loadMs).toBeLessThan(5000);

    // Pagination is active (10 per page).
    await expect(page.getByTestId("product-row")).toHaveCount(10);

    const t1 = Date.now();
    await page.getByTestId("search-input").fill("منتج أداء 4");
    await expect(page.getByTestId("product-row").first()).toBeVisible();
    const searchMs = Date.now() - t1;
    console.log(`[perf] search across ${SEED_COUNT}+ products: ${searchMs}ms`);
    expect(searchMs).toBeLessThan(2000);

    // Exact barcode search narrows to one row.
    await page.getByTestId("search-input").fill(String(9900000000007));
    await expect(page.getByTestId("product-row")).toHaveCount(1);
  });

  test("batch print of 20 labels renders without blocking", async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      window.print = () => {};
    });
    const ids = seededIds.slice(0, 20);
    const t0 = Date.now();
    await page.goto(`/print?ids=${ids.join(",")}`);
    await expect(page.getByTestId("print-label")).toHaveCount(20);
    const renderMs = Date.now() - t0;
    console.log(`[perf] 20-label batch print render: ${renderMs}ms`);
    expect(renderMs).toBeLessThan(10000);
  });
});
