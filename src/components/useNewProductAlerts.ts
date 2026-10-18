"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";

/** Most recent alerts kept on screen; older ones drop off the stack. */
const MAX_VISIBLE = 4;

export type ProductAlert = { product: ApiProduct; at: number };

/**
 * Employee "new product" alerts while the page is open. Watches the polled
 * product list and, for every product whose id is above the highest one
 * already seen, raises an in-app card and plays a chime. System
 * notifications (closed tab, locked phone) come from Web Push instead —
 * see src/lib/push.ts and public/sw.js. Product ids are AUTOINCREMENT, so
 * "id above the max seen" is exactly "created since the last poll" — no
 * clock comparison.
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
  }, [products, loaded, enabled]);

  const dismiss = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.product.id !== id));
  }, []);

  return { alerts, dismiss };
}
