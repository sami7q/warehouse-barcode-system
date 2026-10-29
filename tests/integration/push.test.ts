import crypto from "node:crypto";
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
// @ts-expect-error — untyped CJS dependency of web-push
import ece from "http_ece";

const authState = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => authState.session) }));

/**
 * Stand-in for the browser push service. Each request goes through
 * web-push's real generateRequestDetails (real VAPID JWT + real aes128gcm
 * payload encryption); only the HTTPS hop is skipped. statusFor lets a test
 * make an endpoint answer like an expired subscription.
 */
type Delivered = {
  endpoint: string;
  headers: Record<string, string>;
  body: Buffer;
};
const pushService = vi.hoisted(() => ({
  delivered: [] as Delivered[],
  statusFor: new Map<string, number>(),
}));
vi.mock("web-push", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: Record<string, unknown> };
  const real = actual.default as {
    generateRequestDetails: (
      ...args: unknown[]
    ) => { endpoint: string; headers: Record<string, string>; body: Buffer };
  };
  return {
    default: {
      ...actual.default,
      sendNotification: async (...args: unknown[]) => {
        const details = real.generateRequestDetails(...args);
        const status = pushService.statusFor.get(details.endpoint) ?? 201;
        if (status >= 400) throw Object.assign(new Error("push"), { statusCode: status });
        pushService.delivered.push(details);
        return { statusCode: status };
      },
    },
  };
});

import webpush from "web-push";
import { getDb, resetDbForTests } from "@/db";
import { products, pushSubscriptions, users } from "@/db/schema";
import { POST as CREATE_PRODUCT } from "@/app/api/products/route";
import {
  DELETE as DELETE_PRODUCT,
  PUT as UPDATE_PRODUCT,
} from "@/app/api/products/[id]/route";
import {
  DELETE as PUSH_DELETE,
  GET as PUSH_GET,
  POST as PUSH_POST,
} from "@/app/api/push/route";
import { DELETE as USER_DELETE } from "@/app/api/users/[id]/route";
import { GET as USERS_GET } from "@/app/api/users/route";
import { POST as TEST_PUSH } from "@/app/api/push/test/route";

const TMP_DIR = path.join(process.cwd(), "tests", "tmp");
const DB_FILE = path.join(TMP_DIR, `push-${process.pid}.db`);

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

/** A fake browser device: real P-256 key pair + auth secret. */
function makeDevice(name: string) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16).toString("base64url");
  return {
    ecdh,
    auth,
    subscription: {
      endpoint: `https://fcm.googleapis.com/fcm/send/${name}-${crypto.randomUUID()}`,
      keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth },
    },
  };
}

function decrypt(device: ReturnType<typeof makeDevice>, body: Buffer) {
  const plain: Buffer = ece.decrypt(body, {
    version: "aes128gcm",
    privateKey: device.ecdh,
    authSecret: device.auth,
  });
  return JSON.parse(plain.toString("utf8"));
}

const asAdmin = () => {
  authState.session = { user: { id: String(adminId), role: "admin" } };
};
const asEmployee = (id: number) => {
  authState.session = { user: { id: String(id), role: "employee" } };
};

async function subscribe(device: ReturnType<typeof makeDevice>) {
  return PUSH_POST(req("/api/push", "POST", device.subscription));
}

async function createProduct(name: string) {
  asAdmin();
  const res = await CREATE_PRODUCT(
    req("/api/products", "POST", {
      name,
      purchase_price: 1000,
      sell_price: 70000,
      unit_price: 2000,
      quantity: 12,
    }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { product: { id: number; barcode: string } })
    .product;
}

let adminId = 0;
let employeeA = 0;
let employeeB = 0;

beforeAll(async () => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
  process.env.TURSO_DATABASE_URL = `file:${DB_FILE.replace(/\\/g, "/")}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.BARCODE_PREFIX = "628110";
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  resetDbForTests();
  await migrate(getDb(), { migrationsFolder: "./drizzle" });

  const now = Date.now();
  const rows = await getDb()
    .insert(users)
    .values([
      { email: "admin@push.test", passwordHash: "x", role: "admin", createdAt: now },
      { email: "a@push.test", passwordHash: "x", role: "employee", createdAt: now },
      { email: "b@push.test", passwordHash: "x", role: "employee", createdAt: now },
    ])
    .returning();
  [adminId, employeeA, employeeB] = rows.map((r) => r.id);
});

afterAll(() => {
  try {
    fs.rmSync(DB_FILE);
  } catch {
    // best-effort cleanup
  }
});

beforeEach(async () => {
  pushService.delivered.length = 0;
  pushService.statusFor.clear();
  await getDb().delete(pushSubscriptions);
  await getDb().delete(products);
});

describe("without VAPID keys configured", () => {
  it("GET /api/push reports 503 and product creation still succeeds", async () => {
    asEmployee(employeeA);
    expect((await PUSH_GET()).status).toBe(503);
    expect((await TEST_PUSH()).status).toBe(503);
    await subscribe(makeDevice("no-keys"));
    await createProduct("بدون مفاتيح");
    expect(pushService.delivered).toHaveLength(0);
  });
});

describe("web push for product changes", () => {
  beforeAll(() => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  });

  it("GET /api/push needs a session and returns the public key", async () => {
    authState.session = null;
    expect((await PUSH_GET()).status).toBe(401);
    asEmployee(employeeA);
    const res = await PUSH_GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      publicKey: process.env.VAPID_PUBLIC_KEY,
    });
  });

  it("rejects a malformed subscription", async () => {
    asEmployee(employeeA);
    const res = await PUSH_POST(
      req("/api/push", "POST", { endpoint: "not a url", keys: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("only accepts endpoints on real push-service hosts (no SSRF)", async () => {
    asEmployee(employeeA);
    const keys = makeDevice("x").subscription.keys;
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/x", // not https
      "https://169.254.169.254/latest/meta-data", // cloud metadata
      "https://localhost/internal",
      "https://127.0.0.1:3000/api/users",
      "https://fcm.googleapis.com:8443/fcm/send/x", // odd port
      "https://evil.example.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x", // suffix trick
      "https://notgoogle.com/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://mail.google.com/x", // google.com is not a blanket allow
      "https://jmt1.google.com.evil.example/x",
      "https://fcm.googleapis.com\\@evil.example/x", // parser differential
      "https://evil.example\\@fcm.googleapis.com/x",
      " https://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com/fcm/send/x\n",
      "https://FCM.googleapis.com/fcm/send/x", // non-canonical
      "https://fcm.googleapis.com/fcm/../send/x",
    ]) {
      const res = await PUSH_POST(req("/api/push", "POST", { endpoint, keys }));
      expect(res.status, endpoint).toBe(400);
    }
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);

    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://jmt17.google.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      const res = await PUSH_POST(req("/api/push", "POST", { endpoint, keys }));
      expect(res.status, endpoint).toBe(201);
    }
  });

  it("never sends to a non-allowlisted endpoint already in the table", async () => {
    const device = makeDevice("planted");
    await getDb().insert(pushSubscriptions).values({
      userId: employeeA,
      endpoint: "https://169.254.169.254/latest/meta-data",
      p256dh: device.subscription.keys.p256dh,
      auth: device.subscription.keys.auth,
      createdAt: Date.now(),
    });
    await createProduct("محاولة SSRF");
    expect(pushService.delivered).toHaveLength(0);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("delivers an encrypted, decryptable notification to every employee device", async () => {
    const phoneA = makeDevice("a-phone");
    const laptopA = makeDevice("a-laptop");
    const phoneB = makeDevice("b-phone");
    asEmployee(employeeA);
    expect((await subscribe(phoneA)).status).toBe(201);
    expect((await subscribe(laptopA)).status).toBe(201);
    asEmployee(employeeB);
    expect((await subscribe(phoneB)).status).toBe(201);

    const product = await createProduct("فستق حلبي");

    expect(pushService.delivered).toHaveLength(3);
    for (const device of [phoneA, laptopA, phoneB]) {
      const msg = pushService.delivered.find(
        (d) => d.endpoint === device.subscription.endpoint,
      );
      expect(msg, device.subscription.endpoint).toBeDefined();
      expect(msg!.headers.Authorization).toMatch(/^vapid t=.+, k=.+/);
      expect(msg!.headers.Urgency).toBe("high");
      expect(Number(msg!.headers.TTL)).toBe(86400);
      expect(decrypt(device, msg!.body)).toEqual({
        title: "منتج جديد: فستق حلبي",
        body: expect.stringContaining(product.barcode),
        tag: `c:${product.id}`,
        url: `/?q=${product.barcode}`,
        event: expect.objectContaining({
          kind: "created",
          key: `c:${product.id}`,
          changes: [],
          product: expect.objectContaining({ id: product.id, name: "فستق حلبي" }),
        }),
      });
    }
    expect(decrypt(phoneA, pushService.delivered[0].body).body).toContain(
      "70,000",
    );
  });

  it("a price edit pushes exactly what changed, from → to", async () => {
    const phone = makeDevice("edit");
    asEmployee(employeeA);
    await subscribe(phone);
    const product = await createProduct("لوز");
    pushService.delivered.length = 0;

    asAdmin();
    const res = await UPDATE_PRODUCT(
      req(`/api/products/${product.id}`, "PUT", {
        name: "لوز",
        purchase_price: 1000,
        sell_price: 75000,
        unit_price: 2500,
        quantity: 12,
      }),
      { params: Promise.resolve({ id: String(product.id) }) },
    );
    expect(res.status).toBe(200);
    const { product: updated } = (await res.json()) as {
      product: { updatedAt: number };
    };

    expect(pushService.delivered).toHaveLength(1);
    const msg = decrypt(phone, pushService.delivered[0].body);
    expect(msg.title).toBe("تغيير سعر: لوز");
    expect(msg.body).toBe(
      "سعر البيع: من 70,000 إلى 75,000 دينار\nسعر المفرد: من 2,000 إلى 2,500 دينار",
    );
    expect(msg.tag).toBe(`u:${product.id}:${updated.updatedAt}`);
    expect(msg.event.kind).toBe("updated");
    expect(msg.event.changes.map((c: { field: string }) => c.field)).toEqual([
      "sellPrice",
      "unitPrice",
    ]);
  });

  it("a non-price edit is titled as an edit and lists every changed field", async () => {
    const phone = makeDevice("rename");
    asEmployee(employeeA);
    await subscribe(phone);
    const product = await createProduct("كاجو");
    pushService.delivered.length = 0;

    asAdmin();
    await UPDATE_PRODUCT(
      req(`/api/products/${product.id}`, "PUT", {
        name: "كاجو محمص",
        purchase_price: 1000,
        sell_price: 70000,
        unit_price: 2000,
        quantity: 5,
      }),
      { params: Promise.resolve({ id: String(product.id) }) },
    );
    const msg = decrypt(phone, pushService.delivered[0].body);
    expect(msg.title).toBe("تعديل منتج: كاجو محمص");
    expect(msg.body).toBe(
      "اسم المنتج: من كاجو إلى كاجو محمص\nالكمية: من 12 إلى 5",
    );
  });

  it("a save that changes nothing sends no push", async () => {
    asEmployee(employeeA);
    await subscribe(makeDevice("noop"));
    const product = await createProduct("بندق");
    pushService.delivered.length = 0;

    asAdmin();
    const res = await UPDATE_PRODUCT(
      req(`/api/products/${product.id}`, "PUT", {
        name: "بندق",
        purchase_price: 1000,
        sell_price: 70000,
        unit_price: 2000,
        quantity: 12,
      }),
      { params: Promise.resolve({ id: String(product.id) }) },
    );
    expect(res.status).toBe(200);
    expect(pushService.delivered).toHaveLength(0);
  });

  it("deleting a product pushes a deletion notice", async () => {
    const phone = makeDevice("delete");
    asEmployee(employeeA);
    await subscribe(phone);
    const product = await createProduct("زبيب");
    pushService.delivered.length = 0;

    asAdmin();
    const res = await DELETE_PRODUCT(req(`/api/products/${product.id}`, "DELETE"), {
      params: Promise.resolve({ id: String(product.id) }),
    });
    expect(res.status).toBe(200);
    const msg = decrypt(phone, pushService.delivered[0].body);
    expect(msg).toEqual({
      title: "حذف منتج: زبيب",
      body: `الباركود: ${product.barcode}\nتم حذفه من النظام`,
      tag: `d:${product.id}`,
      url: "/",
      event: expect.objectContaining({ kind: "deleted", key: `d:${product.id}` }),
    });
  });

  it("does not push to admin devices", async () => {
    asAdmin();
    await subscribe(makeDevice("admin"));
    await createProduct("للمدير");
    expect(pushService.delivered).toHaveLength(0);
  });

  it("re-subscribing the same device re-binds it instead of duplicating", async () => {
    const shared = makeDevice("shared");
    asEmployee(employeeA);
    await subscribe(shared);
    asEmployee(employeeB);
    await subscribe(shared);
    const rows = await getDb().select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(employeeB);
  });

  it("drops subscriptions the push service reports as gone, keeps the rest", async () => {
    const expired = makeDevice("expired");
    const alive = makeDevice("alive");
    asEmployee(employeeA);
    await subscribe(expired);
    await subscribe(alive);
    pushService.statusFor.set(expired.subscription.endpoint, 410);

    await createProduct("اشتراك منتهي");

    expect(pushService.delivered.map((d) => d.endpoint)).toEqual([
      alive.subscription.endpoint,
    ]);
    const left = await getDb().select().from(pushSubscriptions);
    expect(left.map((r) => r.endpoint)).toEqual([alive.subscription.endpoint]);
  });

  it("a push-service error never fails product creation", async () => {
    const flaky = makeDevice("flaky");
    asEmployee(employeeA);
    await subscribe(flaky);
    pushService.statusFor.set(flaky.subscription.endpoint, 500);
    await createProduct("خطأ مؤقت"); // asserts 201 inside
    // A transient error is not a dead subscription: keep it.
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(1);
  });

  it("DELETE /api/push removes only the caller's own device", async () => {
    const mine = makeDevice("mine");
    asEmployee(employeeA);
    await subscribe(mine);

    asEmployee(employeeB);
    await PUSH_DELETE(req("/api/push", "DELETE", { endpoint: mine.subscription.endpoint }));
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(1);

    asEmployee(employeeA);
    const res = await PUSH_DELETE(
      req("/api/push", "DELETE", { endpoint: mine.subscription.endpoint }),
    );
    expect(res.status).toBe(200);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("تجربة الإشعار: reaches only the caller's own devices", async () => {
    authState.session = null;
    expect((await TEST_PUSH()).status).toBe(401);

    asEmployee(employeeA);
    const none = await TEST_PUSH();
    expect(none.status).toBe(409);
    expect(((await none.json()) as { error: string }).error).toContain("فعّل الإشعارات");

    const mine = makeDevice("mine-test");
    await subscribe(mine);
    asEmployee(employeeB);
    const theirs = makeDevice("theirs-test");
    await subscribe(theirs);

    asEmployee(employeeA);
    const res = await TEST_PUSH();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1 });
    expect(pushService.delivered.map((d) => d.endpoint)).toEqual([
      mine.subscription.endpoint,
    ]);
    const msg = decrypt(mine, pushService.delivered[0].body);
    expect(msg.title).toBe("تجربة الإشعارات");
    expect(msg.event).toBeUndefined();
  });

  it("the admin's employee list shows how many devices each can be reached on", async () => {
    asEmployee(employeeA);
    await subscribe(makeDevice("a1"));
    await subscribe(makeDevice("a2"));
    asAdmin();
    const res = await USERS_GET();
    const { users: list } = (await res.json()) as {
      users: { id: number; pushDevices: number }[];
    };
    const byId = new Map(list.map((u) => [u.id, u.pushDevices]));
    expect(byId.get(employeeA)).toBe(2);
    expect(byId.get(employeeB)).toBe(0);
  });

  it("deleting an employee account removes their devices", async () => {
    const now = Date.now();
    const [temp] = await getDb()
      .insert(users)
      .values({ email: `temp-${now}@push.test`, passwordHash: "x", role: "employee", createdAt: now })
      .returning();
    asEmployee(temp.id);
    await subscribe(makeDevice("temp"));

    asAdmin();
    const res = await USER_DELETE(req(`/api/users/${temp.id}`, "DELETE"), {
      params: Promise.resolve({ id: String(temp.id) }),
    });
    expect(res.status).toBe(200);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });
});
