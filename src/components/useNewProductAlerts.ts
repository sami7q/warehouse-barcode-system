"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { fmtNumber } from "@/lib/format";
import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";

/** Most recent alerts kept on screen; older ones drop off the stack. */
const MAX_VISIBLE = 4;

export type ProductAlert = { product: ApiProduct; at: number };

/**
 * Employee "new product" alerts. Watches the polled product list and, for
 * every product whose id is above the highest one already seen, raises an
 * in-app card, plays a chime, and (if the employee allowed it) shows a
 * system notification. Product ids are AUTOINCREMENT, so "id above the max
 * seen" is exactly "created since the last poll" — no clock comparison.
 *
 * The very first loaded list only sets the baseline: products that already
 * existed when the page opened are never announced.
 */
export function useNewProductAlerts(
  products: ApiProduct[],
  loaded: boolean,
  enabled: boolean,
) {
  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const maxSeenId = useRef<number | null>(null);

  // Audio can only start inside a user gesture: unlock on the first one.
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      void unlockAlertSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !loaded) return;
    const max = products.reduce((m, p) => Math.max(m, p.id), 0);
    const baseline = maxSeenId.current;
    maxSeenId.current = Math.max(baseline ?? 0, max);
    if (baseline === null) return;

    const fresh = products
      .filter((p) => p.id > baseline)
      .sort((a, b) => a.id - b.id);
    if (fresh.length === 0) return;

    const now = Date.now();
    setAlerts((prev) =>
      [...fresh.map((product) => ({ product, at: now })).reverse(), ...prev]
        .slice(0, MAX_VISIBLE),
    );
    playAlertSound();
    navigator.vibrate?.(200);
    showSystemNotification(fresh);
  }, [products, loaded, enabled]);

  const dismiss = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.product.id !== id));
  }, []);

  return { alerts, dismiss };
}

function showSystemNotification(fresh: ApiProduct[]) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const [first] = fresh;
  const title =
    fresh.length === 1
      ? `منتج جديد: ${first.name}`
      : `تمت إضافة ${fresh.length} منتجات جديدة`;
  const body =
    fresh.length === 1
      ? `الباركود: ${first.barcode}\nسعر البيع: ${fmtNumber(first.sellPrice)} دينار`
      : fresh.map((p) => p.name).join("، ");
  try {
    new Notification(title, {
      body,
      icon: "/icon.svg",
      tag: `new-product-${first.id}`,
      lang: "ar",
      dir: "rtl",
    });
  } catch {
    // Android Chrome forbids the constructor outside a service worker; the
    // in-app card and chime still fire, which is what matters on mobile.
  }
}
