import type { TileSetDefinition, TileSetId, WorldXY } from "@/types/map";

/**
 * Tuiles map.gtadb.org (successeur de gta6map.github.io, même auteur) :
 *  - tuiles 256×256 px, niveaux 0..6
 *  - au niveau 0 la carte (32 768 m) fait 1024 px ⇒ grille 4×4 tuiles ; niveau z ⇒ 4·2^z tuiles/axe
 *  - niveau 5 : 1 px/m ; niveau 6 : 2 px/m
 *  - URL : `{base}/{set}/{z}/{z},{y},{x}.jpg` (attention : y avant x)
 */
export const MAP_SIZE_METERS = 32_768;
export const TILE_SIZE = 256;
/** Largeur en px de la carte entière au zoom 0 (indépendante de la taille de tuile). */
export const ZOOM0_PIXELS = 1024;
export const MIN_NATIVE_ZOOM = 0;
export const MAX_NATIVE_ZOOM = 6;
/** Zoom max côté Leaflet : les niveaux > 6 sont des upscales de la tuile z=6. */
export const MAX_ZOOM = 8;
export const MIN_ZOOM = 1;

/** Facteur px/m au zoom 0 : 1024 px pour 32 768 m. */
export const ZOOM0_SCALE = ZOOM0_PIXELS / MAP_SIZE_METERS; // 1/32

/** Étendue théorique du monde (m). */
export const WORLD_BOUNDS: readonly [WorldXY, WorldXY] = [
  [-MAP_SIZE_METERS / 2, -MAP_SIZE_METERS / 2],
  [MAP_SIZE_METERS / 2, MAP_SIZE_METERS / 2],
];

/**
 * Zone couverte par les tuiles `yanis,15` au z=6 : x ∈ [0,155], y ∈ [34,190] (tuiles de 128 m).
 * Format : [[xMin, yMin], [xMax, yMax]] en mètres.
 */
export const COVERED_BOUNDS: readonly [WorldXY, WorldXY] = [
  [-16_384, -8_064],
  [3_584, 12_032],
];

/** Vue par défaut (identique au site d'origine). */
export const DEFAULT_VIEW = {
  center: [-4_000, 2_000] as WorldXY,
  zoom: 2,
} as const;

const YANIS_RANGES = {
  0: [[0, 0], [2, 2]],
  1: [[0, 1], [4, 5]],
  2: [[0, 2], [9, 11]],
  3: [[0, 4], [19, 23]],
  4: [[0, 8], [38, 47]],
  5: [[0, 17], [77, 95]],
  6: [[0, 34], [155, 190]],
} as const;

export const TILE_SETS: Readonly<Record<TileSetId, TileSetDefinition>> = {
  "yanis,15": { id: "yanis,15", label: "Yanis v15 (recommandé)", author: "Yanis", ranges: YANIS_RANGES },
  "yanis,14": { id: "yanis,14", label: "Yanis v14", author: "Yanis", ranges: YANIS_RANGES },
  "dupzor,51": {
    id: "dupzor,51",
    label: "Dupzor v51",
    author: "Dupzor",
    ranges: {
      0: [[0, 0], [2, 2]],
      1: [[0, 1], [4, 5]],
      2: [[0, 2], [9, 11]],
      3: [[0, 4], [19, 23]],
      4: [[0, 8], [38, 47]],
      5: [[0, 17], [77, 94]],
      6: [[1, 34], [155, 188]],
    },
  },
};

export const TILE_SET_IDS = Object.keys(TILE_SETS) as TileSetId[];
export const DEFAULT_TILE_SET: TileSetId = "yanis,15";

function normalizeBase(value: string | undefined, fallback: string): string {
  return (value && value.trim() ? value : fallback).replace(/\/+$/, "");
}

/**
 * Base d'un miroir d'assets (dossier `public/` en dev, bucket R2/S3 en prod), ou
 * `null` si aucun n'est configuré : `src/lib/media.ts` sert alors la source
 * publique d'origine. Ne jamais retomber sur `/photos` & co. par défaut : ces
 * dossiers sont ignorés par git et absents des déploiements.
 */
function mirrorBase(value: string | undefined): string | null {
  const base = value?.trim().replace(/\/+$/, "");
  return base ? base : null;
}

/**
 * Base URL des tuiles. Par défaut : CDN communautaire maps.gtadb.org (attribution
 * obligatoire). En prod, miroir R2/S3 via `scripts/mirror-tiles.ts` +
 * `NEXT_PUBLIC_TILES_BASE_URL`.
 */
export const TILES_BASE_URL = normalizeBase(process.env.NEXT_PUBLIC_TILES_BASE_URL, "https://maps.gtadb.org/tiles/6");

/** Miroirs (facultatifs) des photos landmarks, frames de trailers et vignettes wiki. */
export const PHOTOS_BASE_URL = mirrorBase(process.env.NEXT_PUBLIC_PHOTOS_BASE_URL);
export const FRAMES_BASE_URL = mirrorBase(process.env.NEXT_PUBLIC_FRAMES_BASE_URL);
export const WIKI_IMAGES_BASE_URL = mirrorBase(process.env.NEXT_PUBLIC_WIKI_IMAGES_BASE_URL);

/** Source publique des photos gtadb : `{origine}/{id},{ig|rl}.jpg` (Public Domain). */
export const GTADB_PHOTOS_ORIGIN = "https://map.gtadb.org/photos/6";

/** Tuile 1×1 px transparente (data URI) hors couverture — évite les 404. */
export const BLANK_TILE_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Couleur de fond de l'océan hors tuiles (assortie aux tuiles Yanis). */
export const OCEAN_COLOR = "#2d8fd5";
