import type { TileRangesByZoom, TileSetId } from "@/types/map";
import { BLANK_TILE_URL, MAX_NATIVE_ZOOM, TILES_BASE_URL, TILE_SETS } from "./config";

export interface TileCoords {
  z: number;
  x: number;
  y: number;
}

export function isInRange(ranges: TileRangesByZoom, { z, x, y }: TileCoords): boolean {
  const range = ranges[z];
  if (!range) return false;
  const [[x0, y0], [x1, y1]] = range;
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/** URL finale d'une tuile (ou tuile vide hors couverture). */
export function buildTileUrl(tileSet: TileSetId, coords: TileCoords): string {
  if (coords.z > MAX_NATIVE_ZOOM || !isInRange(TILE_SETS[tileSet].ranges, coords)) return BLANK_TILE_URL;
  return `${TILES_BASE_URL}/${encodeURIComponent(tileSet)}/${coords.z}/${coords.z},${coords.y},${coords.x}.jpg`;
}

/** Nombre total de tuiles d'un jeu (utile pour le script de miroir). */
export function countTiles(tileSet: TileSetId): number {
  let n = 0;
  for (const range of Object.values(TILE_SETS[tileSet].ranges)) {
    const [[x0, y0], [x1, y1]] = range;
    n += (x1 - x0 + 1) * (y1 - y0 + 1);
  }
  return n;
}
