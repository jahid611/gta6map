"use client";

interface RealWorldMapProps {
  lat: number;
  lng: number;
  /** Libellé du lieu réel, pour le titre accessible du cadre. */
  label: string;
}

/**
 * Vue du monde réel pour un lieu du jeu, via Google Maps.
 *
 * Pourquoi une carte par lieu et non une superposition sur toute la carte du
 * jeu : la géographie de Leonida est un collage. Port Gellhorn correspond à
 * Panama City, à 563 km de Miami dans la réalité, alors que le jeu les place à
 * une dizaine de kilomètres l'un de l'autre. Un ajustement affine sur les 1 043
 * correspondances confirmées donne 24 km d'erreur médiane — et encore 529 m en
 * se limitant au seul bloc de Miami, où le jeu compresse la ville d'un facteur
 * 2,8. Inexploitable pour un calage au pixel. Chaque correspondance prise
 * isolément, en revanche, est exacte : c'est à cette échelle que la vue réelle
 * a du sens.
 *
 * Le cadre `output=embed` de Google Maps ne réclame pas de clé d'API et place
 * son propre repère sur le point demandé. Afficher *plusieurs* points
 * personnalisés exigerait l'API JavaScript Maps, donc une clé facturable et un
 * script tiers sur toutes les pages — hors de proportion pour un aperçu.
 *
 * `loading="lazy"` : le cadre ne se charge qu'une fois déplié et visible.
 */
export function RealWorldMap({ lat, lng, label }: RealWorldMapProps) {
  const src = `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

  return (
    <iframe
      src={src}
      title={`${label} — vue réelle`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="h-52 w-full rounded-xl border border-border"
    />
  );
}
