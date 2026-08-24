import L from "leaflet";
import { MAP_SIZE_METERS, ZOOM0_SCALE } from "./config";

/**
 * CRS custom pour la carte GTA VI.
 *
 * Basé sur `L.CRS.Simple` (projection identité : lat → y, lng → x) avec une
 * transformation affine choisie pour qu'au zoom 0 la carte entière (32 768 m)
 * occupe exactement une tuile de 1024 px, origine en haut à gauche :
 *
 *   px = (lng + 16384) / 32 · 2^zoom
 *   py = (16384 − lat) / 32 · 2^zoom
 *
 * Conséquences :
 *  - `L.latLng(y, x)` avec x, y en mètres RAGE ⇒ aucun facteur d'échelle à gérer
 *  - les indices de tuiles Leaflet `{z}/{x}/{y}` correspondent exactement aux
 *    fichiers générés par `tiles.py`
 *  - `map.distance()` renvoie des mètres
 */
export const GtaCRS: L.CRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(
    ZOOM0_SCALE,
    (MAP_SIZE_METERS / 2) * ZOOM0_SCALE,
    -ZOOM0_SCALE,
    (MAP_SIZE_METERS / 2) * ZOOM0_SCALE,
  ),
  infinite: false,
});
