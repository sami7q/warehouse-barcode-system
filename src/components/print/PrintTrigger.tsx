"use client";

import { useEffect } from "react";
import { PRINT_DELAY_MS } from "@/lib/constants";

/** Calls window.print() shortly after mount so barcode SVGs have painted. */
export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), PRINT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return null;
}
