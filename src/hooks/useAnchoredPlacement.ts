"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Écart entre l'ancre et le menu, et marge minimale gardée aux bords. */
const GAP = 8;
const MARGIN = 12;
/** Hauteur en deçà de laquelle se replier au-dessus ne vaut plus la peine. */
const MIN_HEIGHT = 140;

export interface Placement {
  /** Côté où le menu se déploie. */
  y: "bottom" | "top";
  /** Bord de l'ancre sur lequel il s'aligne. */
  x: "start" | "end";
  /** Hauteur maximale disponible de ce côté, en pixels. */
  max: number;
}

/**
 * Choisit de quel côté un menu ancré doit se déployer.
 *
 * Un menu qui s'ouvre toujours vers le bas se retrouve à cheval sur le bord de
 * la fenêtre dès que son ancre est dans la moitié basse de l'écran : la liste
 * est là, mais on ne peut plus atteindre ses dernières entrées. On mesure donc
 * la place réellement disponible de part et d'autre au moment de l'ouverture,
 * et l'on bascule vers le haut quand le bas ne suffit pas — de même à
 * l'horizontale, où l'alignement s'inverse plutôt que de déborder de l'écran.
 *
 * La mesure est reprise au défilement et au redimensionnement : la page bouge
 * sous un menu resté ouvert, et le côté retenu à l'ouverture peut cesser d'être
 * le bon.
 *
 * `useLayoutEffect` et non `useEffect` : la mesure doit être faite avant que le
 * navigateur ne peigne, sinon le menu apparaît une image en dessous puis saute
 * au-dessus.
 *
 * @param open      État d'ouverture du menu — rien n'est mesuré tant qu'il est
 *                  fermé.
 * @param anchorRef Élément sur lequel le menu s'aligne (le bouton).
 * @param panelRef  Le menu lui-même, monté même fermé pour être mesurable.
 * @param preferX   Alignement horizontal souhaité, conservé s'il tient.
 * @param cap       Hauteur maximale que le menu ne dépassera jamais.
 */
export function useAnchoredPlacement(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  preferX: "start" | "end" = "start",
  cap = 288,
): Placement {
  const [place, setPlace] = useState<Placement>({ y: "bottom", x: preferX, max: cap });
  // La dernière valeur appliquée, pour ne pas relancer un rendu à chaque
  // événement de défilement quand rien ne change.
  const last = useRef(place);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    // Hauteur voulue par le contenu : le menu étant déjà plafonné et défilant,
    // `scrollHeight` donne sa taille naturelle, pas sa taille affichée.
    const wanted = Math.min(cap, panel.scrollHeight);

    // On reste en bas tant qu'il y tient, ou tant qu'il n'y a pas franchement
    // mieux au-dessus : basculer pour gagner quelques pixels serait gratuit.
    const y: Placement["y"] = below >= wanted || below >= above ? "bottom" : "top";
    const max = Math.max(MIN_HEIGHT, Math.min(cap, y === "bottom" ? below : above));

    const w = panel.offsetWidth;
    let x = preferX;
    if (preferX === "start" && r.left + w > window.innerWidth - MARGIN) x = "end";
    else if (preferX === "end" && r.right - w < MARGIN) x = "start";

    const next: Placement = { y, x, max };
    if (next.y === last.current.y && next.x === last.current.x && Math.abs(next.max - last.current.max) < 8) return;
    last.current = next;
    setPlace(next);
  }, [anchorRef, panelRef, preferX, cap]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    // `capture` : le défilement d'un conteneur interne ne remonte pas jusqu'à
    // la fenêtre, et le menu bougerait sans qu'on en sache rien.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return place;
}
