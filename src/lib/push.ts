import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions, users, type Product } from "@/db/schema";
import { fmtNumber } from "@/lib/format";

/**
 * Server-sent Web Push for the employee "new product" alert. Unlike the
 * in-page poll, this reaches a phone whose browser tab is closed, in the
 * background or behind a locked screen — the browser's push service wakes
 * public/sw.js, which shows the notification.
 *
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (npx web-push
 * generate-vapid-keys) and VAPID_SUBJECT (mailto: or https: contact).
 * Without them push is simply off and everything else keeps working.
 */

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://warehouse-barcode-system.vercel.app",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

/** Payload read by public/sw.js. */
export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

export function newProductPayload(p: Product): PushPayload {
  return {
    title: `منتج جديد: ${p.name}`,
    body: `الباركود: ${p.barcode}\nسعر البيع: ${fmtNumber(p.sellPrice)} دينار · سعر المفرد: ${fmtNumber(p.unitPrice)} دينار · الكمية: ${p.quantity}`,
    tag: `new-product-${p.id}`,
    url: `/?q=${encodeURIComponent(p.barcode)}`,
  };
}

/**
 * Push to every subscribed employee device. Never throws: a failed push
 * must not fail the product creation that triggered it. Subscriptions the
 * push service reports as gone (404/410) are deleted.
 */
export async function notifyEmployeesOfNewProduct(product: Product) {
  if (!configure()) return;
  try {
    const db = getDb();
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      .where(eq(users.role, "employee"));
    if (subs.length === 0) return;

    const payload = JSON.stringify(newProductPayload(product));
    const gone: number[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 24 * 60 * 60, urgency: "high", timeout: 8000 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("web push failed", status ?? err);
        }
      }),
    );
    if (gone.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.id, gone));
    }
  } catch (err) {
    console.error("notifyEmployeesOfNewProduct failed", err);
  }
}
