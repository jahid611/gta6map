import L from "leaflet";
import { MAP_SIZE_METERS, ZOOM0_SCALE } from "./config";

const HALF = MAP_SIZE_METERS / 2;

/**
 * Projection identité (lat → y, lng → x) avec les bornes du monde GTA (±16 384 m).
 *
 * ⚠ `L.Projection.LonLat` déclare des bornes ±180/±90 : avec `infinite: false`,
 * Leaflet en déduirait une plage de tuiles valides de ±180 m autour de l'origine
 * et rejetterait toutes les autres tuiles (carte quasi vide). On redéclare donc
 * les bornes en mètres.
 */
const GtaProjection: L.Projection = L.extend({}, L.Projection.LonLat, {
  bounds: L.bounds([-HALF, -HALF], [HALF, HALF]),
});

/**
 * CRS custom pour la carte GTA VI.
 *
 * Transformation affine choisie pour qu'au zoom 0 la carte entière (32 768 m)
 * occupe exactement 1024 px, origine en haut à gauche :
 *
 *   px = (lng + 16384) / 32 · 2^zoom
 *   py = (16384 − lat) / 32 · 2^zoom
 *
 * Conséquences :
 *  - `L.latLng(y, x)` avec x, y en mètres RAGE ⇒ aucun facteur d'échelle à gérer
 *  - les indices de tuiles Leaflet `{z}/{x}/{y}` (256 px) correspondent aux fichiers gtadb
 *  - `map.distance()` renvoie des mètres
 */
export const GtaCRS: L.CRS = L.extend({}, L.CRS.Simple, {
  projection: GtaProjection,
  transformation: new L.Transformation(ZOOM0_SCALE, HALF * ZOOM0_SCALE, -ZOOM0_SCALE, HALF * ZOOM0_SCALE),
  infinite: false,
});
