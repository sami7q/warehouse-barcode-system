import fs from "node:fs";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { migrate } from "drizzle-orm/libsql/migrator";

// Mutable session container so each test can flip auth on/off.
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
import { DELETE, PUT } from "@/app/api/products/[id]/route";
import { GET as EXPORT_GET } from "@/app/api/products/export/route";
import { GET as BARCODE_GET } from "@/app/api/barcode/route";

const TMP_DIR = path.join(process.cwd(), "tests", "tmp");
const DB_FILE = path.join(TMP_DIR, `integration-${process.pid}.db`);

const validBody = {
  name: "فستق حلبي ممتاز",
  purchase_price: 45000,
  sell_price: 70000,
  unit_price: 2000,
  quantity: 120,
};

function req(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
}

const ctx = (id: string | number) => ({
  params: Promise.resolve({ id: String(id) }),
});

async function createProduct(overrides: Partial<typeof validBody> = {}) {
  const res = await POST(req("/api/products", "POST", { ...validBody, ...overrides }));
  return res;
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

describe("POST /api/products", () => {
  it("creates a row with a valid, unique, prefix-matching EAN-13 barcode", async () => {
    const res = await createProduct();
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.product.name).toBe(validBody.name);
    expect(data.product.barcode).toMatch(/^\d{13}$/);
    expect(data.product.barcode.startsWith("628110")).toBe(true);
    expect(isValidEan13(data.product.barcode)).toBe(true);
    expect(String(data.svg)).toContain("<svg");
  });

  it("never produces a duplicate barcode across 50 back-to-back creates", async () => {
    const barcodes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const res = await createProduct({ name: `منتج ${i}` });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(isValidEan13(data.product.barcode)).toBe(true);
      barcodes.add(data.product.barcode);
    }
    expect(barcodes.size).toBe(50);
  });

  it("rejects negative prices with 400", async () => {
    const res = await createProduct({ sell_price: -10 });
    expect(res.status).toBe(400);
  });

  it("rejects a missing name with 400", async () => {
    const res = await POST(
      req("/api/products", "POST", { ...validBody, name: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a manual barcode and rejects a duplicate with 409", async () => {
    const first = await POST(
      req("/api/products", "POST", { ...validBody, barcode: "6281101000012" }),
    );
    expect(first.status).toBe(201);
    const dup = await POST(
      req("/api/products", "POST", {
        ...validBody,
        name: "آخر",
        barcode: "6281101000012",
      }),
    );
    expect(dup.status).toBe(409);
  });
});

describe("GET /api/products", () => {
  it("returns the right product for ?barcode=X", async () => {
    const created = await (await createProduct()).json();
    const res = await GET(
      req(`/api/products?barcode=${created.product.barcode}`),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.product.id).toBe(created.product.id);
    expect(data.product.name).toBe(validBody.name);
  });

  it("returns 404 JSON for an unknown barcode", async () => {
    const res = await GET(req("/api/products?barcode=9999999999999"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("lists all products", async () => {
    await createProduct({ name: "أ" });
    await createProduct({ name: "ب" });
    const res = await GET(req("/api/products"));
    const data = await res.json();
    expect(data.products).toHaveLength(2);
  });

  it("matches ?q= by exact barcode OR partial case-insensitive name", async () => {
    const created = await (await createProduct({ name: "لوز أمريكي" })).json();
    await createProduct({ name: "جوز برازيلي" });

    const byName = await (await GET(req("/api/products?q=لوز"))).json();
    expect(byName.products).toHaveLength(1);
    expect(byName.products[0].name).toBe("لوز أمريكي");

    const byBarcode = await (
      await GET(req(`/api/products?q=${created.product.barcode}`))
    ).json();
    expect(byBarcode.products).toHaveLength(1);
    expect(byBarcode.products[0].id).toBe(created.product.id);
  });
});

describe("PUT /api/products/:id", () => {
  it("updates a product", async () => {
    const created = await (await createProduct()).json();
    const res = await PUT(
      req(`/api/products/${created.product.id}`, "PUT", {
        ...validBody,
        name: "اسم جديد",
        quantity: 5,
      }),
      ctx(created.product.id),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.product.name).toBe("اسم جديد");
    expect(data.product.quantity).toBe(5);
    expect(data.product.barcode).toBe(created.product.barcode);
  });

  it("returns 404 for a missing product", async () => {
    const res = await PUT(
      req("/api/products/424242", "PUT", validBody),
      ctx(424242),
    );
    expect(res.status).toBe(404);
  });

  it("rejects invalid input with 400", async () => {
    const created = await (await createProduct()).json();
    const res = await PUT(
      req(`/api/products/${created.product.id}`, "PUT", {
        ...validBody,
        quantity: -1,
      }),
      ctx(created.product.id),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/products/:id", () => {
  it("removes the product; a subsequent barcode lookup 404s", async () => {
    const created = await (await createProduct()).json();
    const del = await DELETE(
      req(`/api/products/${created.product.id}`, "DELETE"),
      ctx(created.product.id),
    );
    expect(del.status).toBe(200);

    const lookup = await GET(
      req(`/api/products?barcode=${created.product.barcode}`),
    );
    expect(lookup.status).toBe(404);
  });

  it("returns 404 when the product does not exist", async () => {
    const res = await DELETE(req("/api/products/999999", "DELETE"), ctx(999999));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/products/export", () => {
  it("returns an .xlsx attachment", async () => {
    await createProduct();
    const res = await EXPORT_GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});

describe("authentication", () => {
  it("every /api/products/* route (and /api/barcode) returns 401 when unauthenticated", async () => {
    authState.session = null;

    const list = await GET(req("/api/products"));
    expect(list.status).toBe(401);

    const create = await POST(req("/api/products", "POST", validBody));
    expect(create.status).toBe(401);

    const update = await PUT(
      req("/api/products/1", "PUT", validBody),
      ctx(1),
    );
    expect(update.status).toBe(401);

    const del = await DELETE(req("/api/products/1", "DELETE"), ctx(1));
    expect(del.status).toBe(401);

    const exp = await EXPORT_GET();
    expect(exp.status).toBe(401);

    const bc = await BARCODE_GET(req("/api/barcode?text=123"));
    expect(bc.status).toBe(401);
  });
});

describe("GET /api/barcode", () => {
  it("renders an SVG for arbitrary text", async () => {
    const res = await BARCODE_GET(req("/api/barcode?text=HELLO-123"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(await res.text()).toContain("<svg");
  });

  it("returns 400 for empty text", async () => {
    const res = await BARCODE_GET(req("/api/barcode"));
    expect(res.status).toBe(400);
  });
});
