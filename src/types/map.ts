/**
 * Types du moteur cartographique.
 *
 * Système de coordonnées « monde » (RAGE) :
 *  - unité : mètre
 *  - origine (0, 0) au centre de la carte
 *  - X croît vers l'est, Y croît vers le nord
 *  - étendue théorique : [-16384, 16384] sur les deux axes (32 768 m)
 *
 * Système Leaflet : CRS custom (voir `lib/map/crs.ts`) construit de façon à ce
 * que `lat = y` et `lng = x`. La conversion est donc sans perte.
 */

/** Coordonnées monde en mètres (RAGE). */
export type WorldXY = readonly [x: number, y: number];

/** Coordonnées Leaflet `[lat, lng]`. */
export type LatLngTuple = readonly [lat: number, lng: number];

/** Identifiant d'un jeu de tuiles (dossier sur maps.gtadb.org/tiles/6). */
export type TileSetId = "yanis,15" | "dupzor,51";

/** Plage de tuiles `[[xMin, yMin], [xMax, yMax]]` pour un niveau de zoom donné. */
export type TileRange = readonly [readonly [number, number], readonly [number, number]];

export type TileRangesByZoom = Readonly<Record<number, TileRange>>;

export interface TileSetDefinition {
  id: TileSetId;
  label: string;
  author: string;
  ranges: TileRangesByZoom;
}

export interface MapViewState {
  /** Centre de la vue en coordonnées monde. */
  center: WorldXY;
  zoom: number;
}
