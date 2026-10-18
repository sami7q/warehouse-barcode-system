/**
 * Browser half of the employee push notifications (server half:
 * src/lib/push.ts, worker: public/sw.js).
 */

export type PushSupport = "supported" | "ios-install" | "unsupported";

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupport(): PushSupport {
  const ok =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";
  if (ok) return "supported";
  // iOS only exposes Web Push to a home-screen web app, never a Safari tab.
  return isIos() && !isStandalone() ? "ios-install" : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  return av.every((x, i) => x === b[i]);
}

/**
 * Register the worker, subscribe this device and (re)send the subscription
 * to the server. Safe to call on every page load — it also re-binds the
 * device to whoever is logged in now and repairs a lost server row.
 */
async function subscribeThisDevice(): Promise<void> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const reg = await navigator.serviceWorker.ready;

  const res = await fetch("/api/push", { cache: "no-store" });
  if (!res.ok) throw new Error(`push key unavailable (${res.status})`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  const key = urlBase64ToUint8Array(publicKey);

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // server keys were rotated
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

  const save = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!save.ok) throw new Error(`saving subscription failed (${save.status})`);
}

/**
 * Must be called straight from a click handler: iOS rejects the permission
 * prompt unless it is the first thing done inside the user gesture.
 */
export async function enablePush(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission === "granted") await subscribeThisDevice();
  return permission;
}

/** On page load: keep an already-granted device subscribed. */
export async function syncPush(): Promise<boolean> {
  if (Notification.permission !== "granted") return false;
  await subscribeThisDevice();
  return true;
}

/** On logout: stop pushes to this device for the user leaving it. */
export async function disablePushOnThisDevice(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
