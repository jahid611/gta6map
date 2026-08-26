"use client";

import { usePathname } from "next/navigation";
import { LandingNav } from "@/components/landing/LandingNav";

/**
 * Barre de navigation du site, posée par la mise en page racine : elle est donc
 * la même partout, et une page n'a plus à porter son propre en-tête.
 *
 * Sauf sur la carte, qui a sa propre barre d'outils (recherche, progression,
 * filtres) et occupe tout l'écran — une barre flottante par-dessus mangerait ce
 * qu'on est venu regarder.
 */
export function SiteNav() {
  const pathname = usePathname();
  if (pathname === "/map" || pathname.startsWith("/map/")) return null;
  return <LandingNav />;
}
