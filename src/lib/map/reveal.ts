import type L from "leaflet";

/**
 * Amener l'utilisateur sur un point, de la même façon sur les deux cartes.
 *
 * Le trajet se joue en trois temps :
 *
 *  1. on vole jusqu'au point, serré ;
 *  2. s'il est enfermé dans un groupe, on ouvre le groupe — sinon l'utilisateur
 *     arrive devant une pastille « 34 » et doit chercher lequel des trente-quatre
 *     points le concerne ;
 *  3. une fois posé, on recule d'un cran et demi. Le zoom serré sert à repérer
 *     le point ; le recul rend le quartier autour, sans quoi on atterrit le nez
 *     collé à un toit sans savoir où l'on est.
 *
 * Le recul est **borné par le zoom auquel le point est sorti de son groupe** :
 * reculer davantage le ferait ravaler par le groupe, et on aurait travaillé pour
 * rien. C'est la seule subtilité de cette fonction.
 */
const BACK = 1.5;

interface RevealOptions {
  /** Zoom du palier serré, avant le recul. */
  closeZoom: number;
  /** Groupe de regroupement, si le point peut y être enfermé. */
  group?: L.MarkerClusterGroup | null;
  marker?: L.Marker | null;
}

export function revealPoint(map: L.Map, latlng: L.LatLngExpression, { closeZoom, group, marker }: RevealOptions): void {
  const min = map.getMinZoom();
  const max = map.getMaxZoom();
  map.flyTo(latlng, Math.min(max, Math.max(min, closeZoom)), { duration: 0.9, easeLinearity: 0.25 });
  map.once("moveend", () => settleOnPoint(map, latlng, group, marker));
}

/**
 * Les deux derniers temps seuls — ouverture du groupe puis recul.
 *
 * La carte du jeu s'en sert directement : son vol est déjà lancé ailleurs, par
 * le pont entre Leaflet et les stores. En rejouer un second ici ferait deux
 * trajets pour une seule sélection.
 */
export function settleOnPoint(
  map: L.Map,
  latlng: L.LatLngExpression,
  group?: L.MarkerClusterGroup | null,
  marker?: L.Marker | null,
): void {
  const min = map.getMinZoom();
  const max = map.getMaxZoom();

  const settle = (floor: number) => {
    const target = Math.min(max, Math.max(min, Math.max(floor, map.getZoom() - BACK)));
    if (Math.abs(target - map.getZoom()) < 0.05) return;
    map.flyTo(marker?.getLatLng() ?? latlng, target, { duration: 0.55 });
  };

  if (!group || !marker) {
    settle(min);
    return;
  }
  // `getVisibleParent` renvoie le marqueur lui-même s'il est déjà seul à
  // l'écran : dans ce cas il n'y a aucun groupe à ouvrir.
  const visible = group.getVisibleParent(marker);
  if (!visible || visible === marker) {
    settle(min);
    return;
  }
  group.zoomToShowLayer(marker, () => {
    // Le zoom atteint ici est le plus petit auquel le point est seul : c'est
    // exactement le plancher du recul.
    settle(map.getZoom());
  });
}
