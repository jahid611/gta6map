import type L from "leaflet";

/** Ampleur du recul de contexte, en niveaux de zoom. */
const BACK = 0.6;

interface RevealOptions {
  /**
   * Zoom du palier serré. Doit être au moins égal au seuil de dégroupement,
   * faute de quoi le point resterait enfermé dans son groupe.
   */
  tightZoom: number;
  /**
   * Seuil de dégroupement de la carte (`disableClusteringAtZoom`). Le recul ne
   * descend jamais en dessous : le point serait ravalé par son groupe, et
   * l'utilisateur se retrouverait à chercher lequel des trente le concerne.
   */
  floorZoom: number;
}

/**
 * Amener l'utilisateur sur un point, de la même façon sur les deux cartes.
 *
 * Deux temps : on vole serré, exactement centré sur le point — c'est ce qui
 * permet de le repérer ; puis on recule d'un demi-cran pour rendre le quartier
 * autour, sans quoi on atterrit le nez collé à un toit sans savoir où l'on est.
 *
 * Le palier serré est choisi au-dessus du seuil de dégroupement : y arriver
 * suffit à sortir le point de son groupe, sans passer par `zoomToShowLayer`.
 * C'est délibéré — cette méthode recadre sur *le groupe* et non sur le
 * marqueur, ce qui laissait le point décentré à l'arrivée.
 */
export function revealPoint(map: L.Map, latlng: L.LatLngExpression, { tightZoom, floorZoom }: RevealOptions): void {
  const min = map.getMinZoom();
  const max = map.getMaxZoom();
  const clamp = (z: number) => Math.min(max, Math.max(min, z));

  const tight = clamp(tightZoom);
  map.flyTo(latlng, tight, { duration: 0.9, easeLinearity: 0.25 });

  map.once("moveend", () => {
    const back = clamp(Math.max(floorZoom, tight - BACK));
    if (Math.abs(back - map.getZoom()) < 0.05) return;
    // Même centre : le recul ne doit pas déplacer le point, seulement l'éloigner.
    map.flyTo(latlng, back, { duration: 0.5 });
  });
}
