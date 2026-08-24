import type { LatLngTuple, WorldXY } from "@/types/map";
import { MAP_SIZE_METERS, TILE_SIZE, ZOOM0_PIXELS, ZOOM0_SCALE } from "./config";

/**
 * Conversions entre coordonnées monde (mètres RAGE, Y vers le nord) et
 * coordonnées Leaflet. Grâce au CRS custom (`crs.ts`), `lat = y` et `lng = x`.
 * Ces helpers existent pour rendre l'intention explicite dans le code appelant
 * et centraliser la convention (aucun facteur d'échelle, aucune perte).
 */
export function worldToLatLng(x: number, y: number): LatLngTuple {
  return [y, x];
}

export function latLngToWorld(lat: number, lng: number): WorldXY {
  return [lng, lat];
}

/** Mètres par pixel à un zoom donné (identique à `getMppx` du site d'origine). */
export function metersPerPixel(zoom: number): number {
  return MAP_SIZE_METERS / (ZOOM0_PIXELS * Math.pow(2, zoom));
}

/** Position en pixels dans la pyramide de tuiles à un zoom donné (origine haut-gauche). */
export function worldToPixel(x: number, y: number, zoom: number): { px: number; py: number } {
  const scale = ZOOM0_SCALE * Math.pow(2, zoom);
  return {
    px: (x + MAP_SIZE_METERS / 2) * scale,
    py: (MAP_SIZE_METERS / 2 - y) * scale,
  };
}

/** Indices de tuile `{z, x, y}` contenant un point monde. */
export function worldToTile(
  x: number,
  y: number,
  zoom: number,
): { z: number; x: number; y: number } {
  const { px, py } = worldToPixel(x, y, zoom);
  return { z: zoom, x: Math.floor(px / TILE_SIZE), y: Math.floor(py / TILE_SIZE) };
}

/** Distance euclidienne en mètres entre deux points monde. */
export function distanceMeters(a: WorldXY, b: WorldXY): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function formatWorldXY([x, y]: WorldXY, digits = 0): string {
  return `${x.toFixed(digits)}, ${y.toFixed(digits)}`;
}

/** Sérialise une vue pour le hash d'URL `#x,y,z` (compatible avec le site d'origine). */
export function encodeViewHash(center: WorldXY, zoom: number): string {
  return `${Math.round(center[0])},${Math.round(center[1])},${zoom.toFixed(2).replace(/\.?0+$/, "")}`;
}

export function decodeViewHash(hash: string): { center: WorldXY; zoom: number } | null {
  const parts = hash.replace(/^#/, "").split(",").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { center: [parts[0], parts[1]], zoom: parts[2] };
}
