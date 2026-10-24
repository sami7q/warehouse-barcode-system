/*
 * Service worker for employee product push notifications (new, edited,
 * deleted). Payload: { title, body, tag, url, event } — src/lib/push.ts.
 * Runs even when no tab of the app is open, which is the whole point:
 * the in-page poll can't fire on a locked phone or a closed tab.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Open tabs get the event for their in-app card (useProductAlerts),
      // but the sound always comes from this system notification: unlike
      // page audio it needs no prior tap on the page, so it can't be
      // silently blocked. The tab therefore doesn't chime for these.
      const visible = windows.some((c) => c.visibilityState === "visible");
      if (data.event) {
        for (const client of windows) {
          client.postMessage({ type: "product-event", event: data.event });
        }
      }
      await self.registration.showNotification(data.title || "تحديث في المنتجات", {
        body: data.body || "",
        tag: data.tag || "product-event",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        lang: "ar",
        dir: "rtl",
        silent: false,
        // Stay on screen until seen (desktop; phones keep it in the shade).
        // Not needed when the tab is in front — its card is already there.
        requireInteraction: !visible,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The push service rotated this device's subscription: re-subscribe and
// tell the server, so pushes keep arriving without the employee noticing.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/api/push", { credentials: "same-origin" });
      if (!res.ok) return;
      const { publicKey } = await res.json();
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    })(),
  );
});

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
