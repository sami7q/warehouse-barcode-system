import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { migrate } from "drizzle-orm/libsql/migrator";
import ExcelJS from "exceljs";

const authState = vi.hoisted(() => ({
  session: { user: { id: "1", email: "admin@test.local" } } as unknown,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

import { getDb, resetDbForTests } from "@/db";
import { products } from "@/db/schema";
import { isValidEan13 } from "@/lib/ean13";
import { GET, POST } from "@/app/api/products/route";
import { GET as EXPORT_GET } from "@/app/api/products/export/route";

const TMP_DIR = path.join(process.cwd(), "tests", "tmp");
const DB_FILE = path.join(TMP_DIR, `audit-${process.pid}.db`);

const validBody = {
  name: "منتج تدقيق",
  purchase_price: 1000,
  sell_price: 2000,
  unit_price: 100,
  quantity: 10,
};

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeAll(async () => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
  process.env.TURSO_DATABASE_URL = `file:${DB_FILE.replace(/\\/g, "/")}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.BARCODE_PREFIX = "628110";
  resetDbForTests();
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
});

afterAll(() => {
  try {
    fs.rmSync(DB_FILE);
  } catch {
    // best-effort cleanup
  }
});

beforeEach(async () => {
  authState.session = { user: { id: "1", email: "admin@test.local" } };
  await getDb().delete(products);
});

describe("true parallel-write safety (audit Section 3)", () => {
  it("20 genuinely concurrent POSTs (Promise.all) → all succeed, zero duplicate barcodes", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        POST(postReq({ ...validBody, name: `متزامن ${i}` })),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(201);
    }
    const barcodes = await Promise.all(
      responses.map(async (r) => (await r.json()).product.barcode as string),
    );
    for (const barcode of barcodes) {
      expect(isValidEan13(barcode)).toBe(true);
    }
    expect(new Set(barcodes).size).toBe(20);
  });
});

describe("Excel export Arabic round-trip (audit Section 3)", () => {
  it("Arabic product names survive the .xlsx round-trip unmangled", async () => {
    const trickyNames = [
      "فستق حلبي ممتاز",
      "خلطة مكسرات 🥜 فاخرة",
      "لوز أمريكي — درجة أولى",
    ];
    for (const name of trickyNames) {
      const res = await POST(postReq({ ...validBody, name }));
      expect(res.status).toBe(201);
    }

    const exportRes = await EXPORT_GET();
    expect(exportRes.status).toBe(200);
    const buffer = Buffer.from(await exportRes.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("المنتجات");
    expect(sheet).toBeTruthy();

    const namesInSheet: string[] = [];
    sheet!.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      namesInSheet.push(String(row.getCell(3).value));
    });
    for (const name of trickyNames) {
      expect(namesInSheet).toContain(name);
    }
    expect(sheet!.views?.[0]?.rightToLeft).toBe(true);
  });
});

describe("extreme input at the API boundary (audit Section 3)", () => {
  it("rejects a 201-character name with a clear Arabic error, not a crash", async () => {
    const res = await POST(postReq({ ...validBody, name: "م".repeat(201) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("اسم المنتج");
  });

  it("accepts Arabic + emoji + RTL control characters and returns them intact", async () => {
    const tricky = "فستق‏ ‫ممتاز‬ 🥜";
    const res = await POST(postReq({ ...validBody, name: tricky }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.product.name).toBe(tricky);

    const lookup = await GET(
      new NextRequest(
        `http://localhost:3000/api/products?barcode=${data.product.barcode}`,
      ),
    );
    expect((await lookup.json()).product.name).toBe(tricky);
  });

  it("rejects absurdly large price values", async () => {
    const res = await POST(
      postReq({ ...validBody, sell_price: 1_000_000_001 }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects fractional and stringified numbers", async () => {
    expect(
      (await POST(postReq({ ...validBody, sell_price: 99.5 }))).status,
    ).toBe(400);
    expect(
      (await POST(postReq({ ...validBody, quantity: "50" }))).status,
    ).toBe(400);
  });

  it("accepts zero prices/quantity (valid business case)", async () => {
    const res = await POST(
      postReq({
        ...validBody,
        purchase_price: 0,
        sell_price: 0,
        unit_price: 0,
        quantity: 0,
      }),
    );
    expect(res.status).toBe(201);
  });
});
