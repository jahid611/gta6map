import "server-only";

import { cache } from "react";
import type { StreetWorld, StreetZoneSummary } from "@/types/street";

import worldIndex from "@/data/generated/world/index.json";
import viceBeach from "@/data/generated/world/vice-beach.json";
import viceCityDowntown from "@/data/generated/world/vice-city-downtown.json";

/**
 * Quartiers du mode piéton.
 *
 * Ils sont importés statiquement — et non lus depuis le disque — pour que le
 * *bundler* les embarque : sur Vercel, le système de fichiers d'une fonction
 * ne contient que ce qui a été tracé au build. Ajouter un quartier suppose
 * donc de l'ajouter ici aussi, ce que la liste explicite rend évident.
 *
 * Chaque quartier pèse ~600 Ko de JSON. Ils ne sont jamais servis tels quels au
 * client : la page n'envoie que celui qu'on visite.
 */
const WORLDS: Record<string, StreetWorld> = {
  "vice-beach": viceBeach as unknown as StreetWorld,
  "vice-city-downtown": viceCityDowntown as unknown as StreetWorld,
};

export const DEFAULT_ZONE = "vice-beach";

export const getStreetZones = cache(
  async (): Promise<StreetZoneSummary[]> => worldIndex as StreetZoneSummary[],
);

export const getStreetWorld = cache(
  async (id: string): Promise<StreetWorld | null> => WORLDS[id] ?? null,
);

/** slug d'un lieu → quartier où l'on peut aller s'y promener. */
const ZONE_BY_SLUG = new Map<string, string>();
for (const [id, world] of Object.entries(WORLDS)) {
  for (const spot of world.spots) if (!ZONE_BY_SLUG.has(spot.slug)) ZONE_BY_SLUG.set(spot.slug, id);
}

/**
 * Quartier piéton contenant ce lieu, s'il en existe un.
 *
 * Tous les lieux n'en ont pas : le mode piéton ne couvre que les quartiers
 * reconstruits, et une fiche sans coordonnées réelles confirmées n'a de toute
 * façon nulle part où être posée.
 */
export function findStreetZone(slug: string): string | null {
  return ZONE_BY_SLUG.get(slug) ?? null;
}
