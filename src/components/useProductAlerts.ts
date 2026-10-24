"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";
import {
  createdEvent,
  deletedEvent,
  updatedEvent,
  type ProductEvent,
} from "@/lib/product-events";

/** Most recent alerts kept on screen; older ones drop off the stack. */
const MAX_VISIBLE = 4;

export type ProductAlert = ProductEvent & { at: number };

/**
 * Employee in-app alerts for product changes (created / edited / deleted)
 * while the page is open. Two sources feed the same stack, deduped by
 * event key so each change shows once:
 *
 * - the service worker, which forwards every Web Push it receives — instant;
 *   the system notification it shows carries the sound, so no chime here;
 * - the product-list poll, diffed against the previous snapshot — the
 *   fallback for devices without push; plays the in-page chime.
 *
 * The first loaded list only sets the baseline: nothing that happened
 * before the page opened is announced.
 */
export function useProductAlerts(
  products: ApiProduct[],
  loaded: boolean,
  enabled: boolean,
  /** Called when the worker reports a change, to refresh the table now. */
  onRemoteEvent?: () => void,
) {
  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const snapshot = useRef<Map<number, ApiProduct> | null>(null);
  const seen = useRef(new Set<string>());
  const onRemoteEventRef = useRef(onRemoteEvent);
  onRemoteEventRef.current = onRemoteEvent;

  const raise = useCallback((events: ProductEvent[], chime: boolean) => {
    const fresh = events.filter((e) => !seen.current.has(e.key));
    if (fresh.length === 0) return;
    for (const e of fresh) seen.current.add(e.key);
    const now = Date.now();
    setAlerts((prev) =>
      [...fresh.map((e) => ({ ...e, at: now })).reverse(), ...prev].slice(
        0,
        MAX_VISIBLE,
      ),
    );
    if (chime) {
      playAlertSound();
      navigator.vibrate?.(200);
    }
  }, []);

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

  // Events forwarded by public/sw.js from Web Push.
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; event?: ProductEvent } | null;
      if (data?.type !== "product-event" || !data.event?.key) return;
      raise([data.event], false);
      onRemoteEventRef.current?.();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.startMessages();
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [enabled, raise]);

  // Poll results, diffed against the previous list.
  useEffect(() => {
    if (!enabled || !loaded) return;
    const prev = snapshot.current;
    snapshot.current = new Map(products.map((p) => [p.id, p]));
    if (prev === null) return;

    const events: ProductEvent[] = [];
    for (const p of [...products].sort((a, b) => a.id - b.id)) {
      const before = prev.get(p.id);
      if (!before) events.push(createdEvent(p));
      else if (before.updatedAt !== p.updatedAt) {
        const e = updatedEvent(before, p);
        if (e) events.push(e);
      }
    }
    for (const [id, before] of prev) {
      if (!snapshot.current.has(id)) events.push(deletedEvent(before));
    }
    raise(events, true);
  }, [products, loaded, enabled, raise]);

  const dismiss = useCallback((key: string) => {
    setAlerts((prev) => prev.filter((a) => a.key !== key));
  }, []);

  return { alerts, dismiss };
}
