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
/**
 * Zoom minimal.
 *
 * Négatif à dessein : les terres font 13 100 m de large, et il faut donc
 * 33,6 m/px pour les contenir sur un écran de téléphone de 390 px. Or l'échelle
 * au zoom 0 est de 32 m/px — il manque un cheveu, et le cadrage d'ouverture
 * échouait en portrait, laissant Vice City hors de l'écran.
 *
 * Les tuiles n'existent pas sous le niveau 0 : Leaflet réduit celles du niveau 0
 * (`minNativeZoom`), ce qui suffit pour une vue d'ensemble.
 */
export const MIN_ZOOM = -0.5;

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

/**
 * Quadrillage de repérage optionnel.
 *
 * Maille de 1 024 m : puissance de deux alignée sur la grille de tuiles, et
 * découpage de la zone couverte (≈ 20 × 20 km) en un peu moins de 20 × 20
 * cellules — donc une seule lettre par colonne (A → T).
 *
 * L'origine est le coin haut-gauche de la zone couverte, pour que la cellule
 * A1 tombe sur un coin de la carte plutôt qu'au milieu de l'océan.
 */
export const GRID_CELL_METERS = 1_024;

/**
 * Coin haut-gauche du quadrillage, en mètres.
 *
 * Calé sur la côte ouest et non sur `COVERED_BOUNDS` : la bande ouest de la
 * couverture porte le cartouche du fond communautaire (légende, crédits,
 * planche de frames), qu'il serait absurde de recouvrir de repères A1, B1…
 * Le quadrillage ne couvre donc que les terres et leurs abords.
 */
export const GRID_ORIGIN: WorldXY = [-10_200, 12_032];

/** Étendue étiquetée du quadrillage : `[[xMin, yMin], [xMax, yMax]]`. */
export const GRID_BOUNDS: readonly [WorldXY, WorldXY] = [
  [-10_200, -8_064],
  [3_584, 12_032],
];

/**
 * Emprise des terres : union des bornes des 8 régions.
 *
 * Sert de cadrage d'ouverture (`fitBounds`) plutôt qu'un couple centre/zoom
 * figé. Le panneau latéral occupe 340 px et la hauteur utile varie d'un écran
 * à l'autre : un zoom constant cadrait forcément de travers quelque part —
 * au zoom 2, Vice City sortait par la droite. `fitBounds` mesure le conteneur
 * réel et centre les terres dedans.
 *
 * Bornes calées sur l'étendue réelle des lieux (x ∈ [−9 240, 2 714],
 * y ∈ [−7 932, 7 797]) plus une marge, et non sur l'union des boîtes de
 * régions : celles-ci débordent de 4 km au nord sur une zone sans aucun point,
 * ce qui décentrait le cadrage vers le haut et rognait Leonida Keys.
 */
export const LANDMASS_BOUNDS: readonly [WorldXY, WorldXY] = [
  [-9_800, -8_400],
  [3_300, 8_400],
];

/** Vue par défaut (repli si le conteneur n'est pas encore mesurable). */
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

/**
 * Fonds de carte proposés.
 *
 * Les libellés décrivent le rendu plutôt que l'auteur et son numéro de version :
 * « Yanis v15 » ne dit rien à personne, alors que le choix porte en réalité sur
 * un style cartographique. Les auteurs restent crédités dans le contrôle
 * d'attribution de Leaflet.
 *
 * Le jeu « yanis,14 » a été retiré : le serveur de tuiles répond 404 sur toutes
 * ses tuiles, il n'affichait donc qu'une carte vide.
 */
export const TILE_SETS: Readonly<Record<TileSetId, TileSetDefinition>> = {
  "yanis,15": { id: "yanis,15", label: "Détaillée", author: "Yanis", ranges: YANIS_RANGES },
  "dupzor,51": {
    id: "dupzor,51",
    label: "Relief",
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

