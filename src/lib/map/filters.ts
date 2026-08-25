/**
 * Filtres visuels appliqués aux tuiles.
 *
 * Purement décoratif : une valeur de `filter` CSS posée sur la couche de tuiles
 * (`.gta-tiles`), donc sans aucun coût réseau ni retraitement d'image. Les
 * marqueurs, eux, ne sont pas filtrés — ils doivent rester lisibles quel que
 * soit le rendu choisi.
 */
export interface MapFilter {
  id: string;
  label: string;
  /** Valeur CSS de `filter`, ou `null` pour le rendu d'origine. */
  css: string | null;
}

export const MAP_FILTERS: readonly MapFilter[] = [
  { id: "none", label: "Original", css: null },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.25) brightness(0.92)" },
  { id: "cinema", label: "Cinéma", css: "contrast(1.18) saturate(1.25) brightness(0.95) sepia(0.12)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.42) saturate(0.85) contrast(1.08) brightness(1.02)" },
  { id: "neon", label: "Néon", css: "saturate(1.7) contrast(1.15) hue-rotate(-12deg)" },
  { id: "cyber", label: "Cyber", css: "hue-rotate(190deg) saturate(1.45) contrast(1.2) brightness(0.9)" },
  { id: "dusk", label: "Crépuscule", css: "sepia(0.3) hue-rotate(-18deg) saturate(1.35) brightness(0.88)" },
  { id: "blueprint", label: "Blueprint", css: "grayscale(1) invert(1) sepia(1) hue-rotate(185deg) saturate(3.5) brightness(0.75)" },
];

export const DEFAULT_MAP_FILTER = "none";

export function mapFilterCss(id: string): string | null {
  return MAP_FILTERS.find((f) => f.id === id)?.css ?? null;
}
