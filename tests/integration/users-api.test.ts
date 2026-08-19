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

const authState = vi.hoisted(() => ({
  session: {
    user: { id: "1", email: "admin@test.local", role: "admin" },
  } as unknown,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

import { getDb, resetDbForTests } from "@/db";
import { users } from "@/db/schema";
import { GET, POST } from "@/app/api/users/route";
import { DELETE } from "@/app/api/users/[id]/route";
import { POST as PRODUCTS_POST } from "@/app/api/products/route";
import { PUT as PRODUCTS_PUT, DELETE as PRODUCTS_DELETE } from "@/app/api/products/[id]/route";
import { GET as EXPORT_GET } from "@/app/api/products/export/route";

const TMP_DIR = path.join(process.cwd(), "tests", "tmp");
const DB_FILE = path.join(TMP_DIR, `users-api-${process.pid}.db`);

function usersReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const usersCtx = (id: string | number) => ({
  params: Promise.resolve({ id: String(id) }),
});

const productBody = {
  name: "منتج",
  purchase_price: 1000,
  sell_price: 2000,
  unit_price: 100,
  quantity: 10,
};

function productReq(): NextRequest {
  return new NextRequest("http://localhost:3000/api/products", {
    method: "POST",
    body: JSON.stringify(productBody),
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
  authState.session = {
    user: { id: "1", email: "admin@test.local", role: "admin" },
  };
  await getDb().delete(users);
});

describe("POST /api/users (admin)", () => {
  it("creates an employee-role account and never returns the password hash", async () => {
    const res = await POST(
      usersReq({ email: "worker1@shop.local", password: "Password123" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe("worker1@shop.local");
    expect(data.user.role).toBe("employee");
    expect(JSON.stringify(data)).not.toContain("passwordHash");
    expect(JSON.stringify(data)).not.toContain("password_hash");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await POST(
      usersReq({ email: "worker2@shop.local", password: "short" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await POST(
      usersReq({ email: "not-an-email", password: "Password123" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    const first = await POST(
      usersReq({ email: "dup@shop.local", password: "Password123" }),
    );
    expect(first.status).toBe(201);
    const dup = await POST(
      usersReq({ email: "dup@shop.local", password: "Password456" }),
    );
    expect(dup.status).toBe(409);
  });
});

describe("GET /api/users (admin)", () => {
  it("lists employee accounts, excludes admin accounts, never leaks password hashes", async () => {
    await getDb().insert(users).values({
      email: "admin2@shop.local",
      passwordHash: "irrelevant",
      role: "admin",
      createdAt: Date.now(),
    });
    await POST(usersReq({ email: "worker3@shop.local", password: "Password123" }));

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    const emails = data.users.map((u: { email: string }) => u.email);
    expect(emails).toContain("worker3@shop.local");
    expect(emails).not.toContain("admin2@shop.local");
    expect(JSON.stringify(data)).not.toContain("irrelevant");
  });
});

describe("DELETE /api/users/:id (admin)", () => {
  it("removes an employee account", async () => {
    const created = await (
      await POST(usersReq({ email: "worker4@shop.local", password: "Password123" }))
    ).json();
    const res = await DELETE(
      new NextRequest(`http://localhost:3000/api/users/${created.user.id}`, {
        method: "DELETE",
      }),
      usersCtx(created.user.id),
    );
    expect(res.status).toBe(200);

    const list = await (await GET()).json();
    expect(list.users.find((u: { id: number }) => u.id === created.user.id)).toBeUndefined();
  });

  it("refuses to delete an admin-role row even if guessed by id", async () => {
    const [admin] = await getDb()
      .insert(users)
      .values({
        email: "admin3@shop.local",
        passwordHash: "irrelevant",
        role: "admin",
        createdAt: Date.now(),
      })
      .returning();

    const res = await DELETE(
      new NextRequest(`http://localhost:3000/api/users/${admin.id}`, {
        method: "DELETE",
      }),
      usersCtx(admin.id),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/users/999999", {
        method: "DELETE",
      }),
      usersCtx(999999),
    );
    expect(res.status).toBe(404);
  });
});

describe("role enforcement — every user-management and mutating product route rejects employees", () => {
  beforeEach(() => {
    authState.session = {
      user: { id: "2", email: "worker@shop.local", role: "employee" },
    };
  });

  it("GET/POST /api/users → 403 for an employee session", async () => {
    expect((await GET()).status).toBe(403);
    expect(
      (
        await POST(usersReq({ email: "x@shop.local", password: "Password123" }))
      ).status,
    ).toBe(403);
  });

  it("DELETE /api/users/:id → 403 for an employee session", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/users/1", { method: "DELETE" }),
      usersCtx(1),
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/products → 403 for an employee session (price/stock is admin-only)", async () => {
    const res = await PRODUCTS_POST(productReq());
    expect(res.status).toBe(403);
  });

  it("GET /api/products/export → 403 for an employee session", async () => {
    const res = await EXPORT_GET();
    expect(res.status).toBe(403);
  });

  it("PUT and DELETE /api/products/:id → 403 for an employee session (existing product untouched)", async () => {
    authState.session = {
      user: { id: "1", email: "admin@test.local", role: "admin" },
    };
    const created = await (await PRODUCTS_POST(productReq())).json();

    authState.session = {
      user: { id: "2", email: "worker@shop.local", role: "employee" },
    };
    const putRes = await PRODUCTS_PUT(
      new NextRequest(`http://localhost:3000/api/products/${created.product.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...productBody, name: "اسم مسروق" }),
        headers: { "content-type": "application/json" },
      }),
      usersCtx(created.product.id),
    );
    expect(putRes.status).toBe(403);

    const delRes = await PRODUCTS_DELETE(
      new NextRequest(`http://localhost:3000/api/products/${created.product.id}`, {
        method: "DELETE",
      }),
      usersCtx(created.product.id),
    );
    expect(delRes.status).toBe(403);
  });
});
