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
        {/* Jet aux couleurs de Vice City, vu de dessus — l'image est fournie par
            le propriétaire du site. La démo de l'original montrait un jet
            photoréaliste, mais son adresse pointe vers le CDN d'un autre site :
            ni reprenable, ni pointable.

            Vue de dessus déjà à l'horizontale, nez à droite : aucune rotation à
            appliquer, contrairement au rendu qu'il remplace. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/vice-city-jet.png"
          alt=""
          // Large comme dans la démo : l'avion traverse l'écran, il ne le
          // survole pas de loin.
          className="w-[70vw] max-w-[1000px] shrink-0 drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        />
      </div>
    </div>
  );
}
