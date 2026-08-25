import manifest from "@/data/generated/media.json";

export type MediaKind = "screenshot" | "artwork" | "clip";

export interface MediaEntry {
  id: string;
  kind: MediaKind;
  /** Regroupement affiché : « Vice City », « Jason Duval »… */
  group: string;
  /** Sous-groupe des screenshots : « People », « Places », ou `null`. */
  section: string | null;
  title: string;
  src: string;
  /** Autres formats du même visuel (portrait, ultrawide…). */
  variants: string[];
  /** Image fixe d'un clip. `null` pour les autres types. */
  poster: string | null;
}

/**
 * Catalogue des médias officiels, produit par `npm run build:media`.
 *
 * Le manifeste est versionné alors que les fichiers eux-mêmes sont ignorés par
 * git (375 Mo) : la galerie sait donc toujours ce qu'elle devrait afficher, et
 * se dégrade en vignettes vides plutôt qu'en page cassée si les fichiers ne sont
 * pas présents sur la machine.
 */
export const MEDIA_CATALOG = manifest as MediaEntry[];

export interface MediaFilter {
  id: string;
  label: string;
  match: (e: MediaEntry) => boolean;
}

export const MEDIA_FILTERS: readonly MediaFilter[] = [
  { id: "all", label: "Tout", match: () => true },
  { id: "people", label: "Personnages", match: (e) => e.kind === "screenshot" && e.section === "People" },
  { id: "places", label: "Lieux", match: (e) => e.kind === "screenshot" && e.section === "Places" },
  { id: "artwork", label: "Artworks", match: (e) => e.kind === "artwork" },
  { id: "clips", label: "Vidéos", match: (e) => e.kind === "clip" },
];

/** Compte les entrées par filtre, pour afficher les effectifs sur les puces. */
export function countByFilter(entries: readonly MediaEntry[]): Record<string, number> {
  return Object.fromEntries(MEDIA_FILTERS.map((f) => [f.id, entries.filter(f.match).length]));
}

/** Clip vidéo d'un personnage, par nom — `null` si aucun ne correspond. */
export function clipFor(name: string): string | null {
  const target = name.toLowerCase();
  return MEDIA_CATALOG.find((e) => e.kind === "clip" && target.startsWith(e.group.toLowerCase()))?.src ?? null;
}
