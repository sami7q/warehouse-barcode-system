import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { notificationFor, type ProductEvent } from "@/lib/product-events";

/**
 * Server-sent Web Push for employee product alerts (created / edited /
 * deleted — see src/lib/product-events.ts). Unlike the
 * in-page poll, this reaches a phone whose browser tab is closed, in the
 * background or behind a locked screen — the browser's push service wakes
 * public/sw.js, which shows the notification.
 *
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (npx web-push
 * generate-vapid-keys) and VAPID_SUBJECT (mailto: or https: contact).
 * Without them push is simply off and everything else keeps working.
 */

/**
 * Hosts of the real browser push services. The server POSTs to whatever
 * endpoint a client registers, so without this any logged-in user could
 * make it send requests to arbitrary (internal) URLs — SSRF.
 */
const PUSH_HOST_PATTERNS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge-on-Android, Android
  /^jmt\d+\.google\.com$/, // Chromium builds
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, // Firefox
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari / iOS
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge / Windows (WNS)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  // web-push sends with Node's legacy url.parse, which can read odd input
  // (backslashes, whitespace, control chars) differently from WHATWG URL.
  // Only accept input that is already canonical, so both parsers agree.
  if (/[\x00-\x20\x7f\\]/.test(endpoint)) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.href !== endpoint) return false;
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) {
    return false;
  }
  return PUSH_HOST_PATTERNS.some((re) => re.test(url.hostname));
}

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

/** Payload read by public/sw.js: notification text + the structured
 * event, which the worker forwards to any open tab for its in-app card. */
export function pushPayload(event: ProductEvent) {
  return { ...notificationFor(event), event };
}

type Target = { id: number; endpoint: string; p256dh: string; auth: string };

const targetColumns = {
  id: pushSubscriptions.id,
  endpoint: pushSubscriptions.endpoint,
  p256dh: pushSubscriptions.p256dh,
  auth: pushSubscriptions.auth,
};

/**
 * Send one payload to the given devices; returns how many accepted it.
 * Never throws. Subscriptions the push service reports as gone (404/410)
 * are deleted.
 */
async function sendTo(subs: Target[], payload: object): Promise<number> {
  if (subs.length === 0) return 0;
  const body = JSON.stringify(payload);
  const gone: number[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      // Defense in depth: rows are validated on insert, but never send to
      // a host outside the allowlist even if one got into the table.
      if (!isAllowedPushEndpoint(s.endpoint)) {
        gone.push(s.id);
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          // urgency high: delivered immediately even when Android is dozing.
          { TTL: 24 * 60 * 60, urgency: "high", timeout: 8000 },
        );
        sent += 1;
      } catch (err) {
        const e = err as { statusCode?: number; body?: string };
        if (e.statusCode === 404 || e.statusCode === 410) {
          console.warn("push subscription expired, removing", e.statusCode, s.id);
          gone.push(s.id);
        } else {
          console.error("web push failed", e.statusCode ?? err, e.body ?? "");
        }
      }
    }),
  );
  if (gone.length > 0) {
    await getDb()
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, gone));
  }
  return sent;
}

/**
 * Push a product event to every subscribed employee device. Never throws:
 * a failed push must not fail the product change that triggered it.
 */
export async function notifyEmployees(event: ProductEvent) {
  if (!configure()) return;
  try {
    const subs = await getDb()
      .select(targetColumns)
      .from(pushSubscriptions)
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      .where(eq(users.role, "employee"));
    await sendTo(subs, pushPayload(event));
  } catch (err) {
    console.error("notifyEmployees failed", err);
  }
}

/**
 * "تجربة الإشعار": a test push to one user's own devices, so an employee
 * can hear their phone ring. Returns the number of devices reached, or
 * null when push isn't configured on the server.
 */
export async function sendTestPush(userId: number): Promise<number | null> {
  if (!configure()) return null;
  const subs = await getDb()
    .select(targetColumns)
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return sendTo(subs, {
    title: "تجربة الإشعارات",
    body: "إذا سمعت الصوت فالإشعارات تعمل على هذا الهاتف ✓",
    tag: `test-${Date.now()}`,
    url: "/",
  });
}
