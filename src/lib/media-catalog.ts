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
 * Base des médias.
 *
 * Vide en local : les fichiers sont servis depuis `public/media`. En production
 * ce dossier n'est pas déployé — il pèse ~384 Mo et reste hors du dépôt — et la
 * variable pointe alors le bucket où `npm run assets:upload` les a envoyés.
 */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").trim().replace(/\/+$/, "");

/** Réécrit un chemin `/media/...` vers le miroir configuré, le cas échéant. */
function resolve(src: string | null): string | null {
  if (!src || !MEDIA_BASE) return src;
  return src.startsWith("/media/") ? MEDIA_BASE + src.slice("/media".length) : src;
}

/**
 * Catalogue des médias officiels, produit par `npm run build:media`.
 *
 * Le manifeste est versionné alors que les fichiers eux-mêmes sont ignorés par
 * git : la galerie sait donc toujours ce qu'elle devrait afficher, et se dégrade
 * en vignettes vides plutôt qu'en page cassée si les fichiers sont absents.
 */
export const MEDIA_CATALOG: MediaEntry[] = (manifest as MediaEntry[]).map((e) => ({
  ...e,
  src: resolve(e.src) as string,
  poster: resolve(e.poster),
  variants: e.variants.map((v) => resolve(v) as string),
}));

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
