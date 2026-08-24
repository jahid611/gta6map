"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void): () => void {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** Media query réactive, SSR-safe (retourne `fallback` côté serveur). */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(query, cb),
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** ≥ 1024px : layout desktop (sidebar à gauche). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)", true);
}
