"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Distance d'avance par défaut, en pixels autour de la fenêtre.
 *
 * Un peu plus d'un écran de haut : à vitesse de défilement ordinaire, cela
 * laisse environ une seconde au réseau, ce qui suffit largement pour une
 * vignette. Monter beaucoup plus haut reviendrait à tout charger d'un coup et
 * ferait perdre au chargement paresseux tout son intérêt.
 */
const MARGIN = "1200px 0px";

/**
 * Dit si un élément approche de la fenêtre — avant d'y entrer.
 *
 * Sert à charger une image *en avance* plutôt qu'au moment où on la découvre.
 * Le chargement paresseux natif décide seul de sa distance de déclenchement, et
 * elle est parfois si courte que la vignette se peint sous les yeux du
 * visiteur ; ici on la fixe, et l'image est arrivée avant lui.
 *
 * La valeur ne redescend jamais : une fois l'image chargée, il n'y a plus rien
 * à décider, et la faire osciller au va-et-vient du défilement relancerait des
 * rendus pour rien. L'observateur se débranche donc dès qu'il a répondu.
 *
 * @param margin Marge de déclenchement, au format `rootMargin`.
 * @returns La `ref` à poser sur l'élément, et l'état d'approche.
 */
export function useNearViewport<T extends Element>(margin: string = MARGIN) {
  const ref = useRef<T>(null);
  // Toujours `false` au départ, sans exception : cette valeur sert aussi au
  // rendu serveur, et la moindre divergence avec le premier rendu client casse
  // l'hydratation. Tout ce qui dépend du navigateur est décidé dans l'effet.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    // Sans IntersectionObserver (navigateur ancien), on s'abstient : l'image
    // reste en `lazy` et se charge à l'ancienne. Elle perd son avance, rien de
    // plus — il n'y a pas d'image manquante au bout de ce chemin.
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [margin, near]);

  return { ref, near };
}
