"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Durée totale du passage, en millisecondes. */
const DURATION = 1100;

/**
 * Transition entre les pages : un avion traverse l'écran au-dessus de Leonida.
 *
 * Reprend le geste de `ravikatiyar162/hero-section-3` (21st.dev) — un avion qui
 * traverse de part en part — mais pas son moteur : l'original lie la position au
 * défilement d'une section haute de deux écrans, ce qui n'a pas de sens pour un
 * changement de page. Ici c'est la route qui déclenche, et le temps qui anime.
 *
 * Sa vitesse est ramenée à quelque chose de tenable : l'original balaie sept
 * largeurs et demie d'écran, ce qui donne un trait plutôt qu'un avion. Une seule
 * traversée en un peu plus d'une seconde laisse le temps de le voir passer sans
 * retarder l'arrivée sur la page.
 *
 * `pointer-events: none` de bout en bout : une transition ne doit jamais retenir
 * un clic. Si la page suivante est prête avant la fin, on peut déjà s'en servir.
 *
 * Neutralisée sous `prefers-reduced-motion` — c'est exactement le genre de
 * mouvement plein écran que ce réglage vise.
 */
export function PageTransition() {
  const pathname = usePathname();
  const [flying, setFlying] = useState(false);
  // Comparaison pendant le rendu plutôt que dans un effet : c'est le motif que
  // React recommande pour réagir à un changement de props, et le seul que le
  // linter accepte ici. Au premier rendu les deux coïncident, donc on n'annonce
  // pas une arrivée qui n'a pas eu lieu.
  const [previous, setPrevious] = useState(pathname);
  if (previous !== pathname) {
    setPrevious(pathname);
    if (typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlying(true);
    }
  }

  useEffect(() => {
    if (!flying) return;
    const timer = window.setTimeout(() => setFlying(false), DURATION);
    return () => window.clearTimeout(timer);
  }, [flying]);

  if (!flying) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[2000] overflow-hidden">
      {/* Le décor : le crépuscule aux palmiers, déjà servi par le hero — donc
          déjà en cache, et cohérent avec l'entrée du site. */}
      <div
        className="absolute inset-0 bg-[url('/brand/vice-sunset.webp')] bg-cover bg-center"
        style={{ animation: `vi-flyby-veil ${DURATION}ms ease-in-out both` }}
      />
      <div className="absolute inset-0 bg-background/55" style={{ animation: `vi-flyby-veil ${DURATION}ms ease-in-out both` }} />

      <div className="absolute inset-0 flex items-center" style={{ animation: `vi-flyby ${DURATION}ms cubic-bezier(0.4, 0, 0.6, 1) both` }}>
        {/* Vrai rendu 3D et non un pictogramme : c'est ce que montre la démo de
            l'original, qui ne livre pourtant aucune image avec son composant.
            Celui-ci vient du jeu Fluent Emoji de Microsoft (licence MIT), le
            seul rendu d'avion détouré que nous ayons le droit d'héberger — un
            avion doit être découpé sur fond transparent pour traverser un décor,
            et aucune de nos captures ne l'est.

            Pivoté : le rendu pointe en diagonale vers le haut, il faut le
            redresser pour qu'il vole à l'horizontale. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/airplane-3d.png"
          alt=""
          className="h-28 w-28 shrink-0 rotate-[38deg] drop-shadow-[0_12px_32px_rgba(0,0,0,0.55)] sm:h-44 sm:w-44"
        />
      </div>
    </div>
  );
}
