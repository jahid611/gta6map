import type { LatLngTuple, WorldXY } from "./map";

/** Statut de confirmation d'une information (nom in-game, correspondance IRL...). */
export type ConfirmationStatus = "confirmed" | "unconfirmed" | "unknown";

/** Origine de la donnée. */
export type LocationSource = "gtadb" | "gta6map" | "gtamaplib" | "gtamaplib-vc" | "manual";

/**
 * Nature du point :
 *  - `landmark` : lieu identifié (bâtiment, monument, zone…)
 *  - `camera`   : position d'une caméra de trailer / screenshot officiel (image géolocalisée)
 */
export type LocationKind = "landmark" | "camera";

export interface LocationPhotos {
  /** Capture in-game (URL relative à `NEXT_PUBLIC_PHOTOS_BASE_URL`). */
  ig: string | null;
  /** Photo du lieu réel équivalent. */
  irl: string | null;
}

export interface LocationRealWorld {
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: ConfirmationStatus;
}

/** Image officielle géolocalisée (frame de trailer ou screenshot Rockstar). */
export interface LocationMedia {
  /** Fichier JPEG 1600 px (relatif à `NEXT_PUBLIC_FRAMES_BASE_URL`). */
  frame: string;
  /** Vignette 480 px. */
  thumb: string;
  /** ex. « Trailer 1 », « Trailer 2 », « Screenshot ». */
  sourceLabel: string;
  /** ex. « Trailer 1 [81] » — libellé brut de gtamaplib. */
  source: string;
  /** Index de frame si connu. */
  frameIndex: number | null;
  /** Orientation caméra (degrés) : yaw 0 = nord, sens horaire. */
  yaw: number;
  pitch: number;
  /** Champ horizontal (degrés) si connu. */
  hfov: number | null;
  /** Dimensions natives de la frame. */
  width: number;
  height: number;
}

/** Page gta.wiki associée. */
export interface LocationWiki {
  title: string;
  url: string;
  extract: string | null;
  /** Vignette locale (relative à `/wiki`) ou URL distante. */
  image: string | null;
}

/**
 * Point d'intérêt normalisé (forme unique côté app, quelle que soit la source :
 * JSON statique généré par le seed ou ligne Supabase).
 */
export interface Location {
  id: string;
  /** Identifiant d'origine (`L264`, `T1/12`, `S2/3`...). */
  legacyId: string;
  slug: string;
  kind: LocationKind;
  name: string;
  /** Statut du nom in-game (`?` dans la source ⇒ `unknown`). */
  nameStatus: ConfirmationStatus;
  /** Zone / quartier in-game (ex. « Vice Beach »). */
  area: string | null;
  categorySlug: string;
  /** Coordonnées monde en mètres. */
  x: number;
  y: number;
  /** Altitude (m) si connue. */
  z: number | null;
  /** Hauteur estimée du bâtiment (m) si connue. */
  height: number | null;
  /** Coordonnées Leaflet pré-calculées `[lat, lng]`. */
  latLng: LatLngTuple;
  description: string | null;
  tags: string[];
  /** Drapeaux éditoriaux issus des tags source : `unconfirmed`, `demolished`, `may-not-exist`, `2022`… */
  flags: string[];
  color: string;
  photos: LocationPhotos;
  media: LocationMedia | null;
  /** Page wiki du lieu lui-même. */
  wiki: LocationWiki | null;
  /** Page wiki de la zone / du quartier (`area`). */
  areaWiki: LocationWiki | null;
  realWorld: LocationRealWorld;
  source: LocationSource;
  /** ISO 8601. */
  updatedAt: string;
}

/** Sous-ensemble minimal envoyé au client pour le rendu des marqueurs. */
export type LocationMarker = Pick<Location, "id" | "slug" | "name" | "kind" | "categorySlug" | "latLng" | "color">;

export interface LocationSearchResult {
  location: Location;
  score: number;
}

/** Zone / quartier déduit des lieux (centre médian) + fiche wiki éventuelle. */
export interface AreaInfo {
  name: string;
  slug: string;
  x: number;
  y: number;
  /** Nombre de lieux dans la zone. */
  count: number;
  wiki: LocationWiki | null;
}

/** Section nommée de la carte (bbox monde) — issue de gtamaplib `map_sections`. */
export interface MapSection {
  name: string;
  slug: string;
  /** [xMin, yMin, xMax, yMax] en mètres. */
  bounds: [number, number, number, number];
  wiki: LocationWiki | null;
}

export function worldXY(location: Pick<Location, "x" | "y">): WorldXY {
  return [location.x, location.y];
}
