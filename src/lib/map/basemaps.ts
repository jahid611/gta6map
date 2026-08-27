/**
 * Fonds de carte du monde réel, partagés par la vue plein écran et par l'aperçu
 * d'une fiche de lieu.
 *
 * « Satellite » par défaut : on vient chercher à quoi ressemble vraiment
 * l'endroit, pas son plan de rues. Le fond « Plan » reste utile pour lire les
 * noms de voies et se repérer.
 *
 * Esri World Imagery et OpenStreetMap sont tous deux libres d'usage sous
 * réserve d'attribution — celle-ci est portée par la carte.
 */
export const BASEMAPS = [
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "plan",
    label: "Plan",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
] as const;

export type BasemapId = (typeof BASEMAPS)[number]["id"];
