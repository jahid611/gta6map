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
        {/* Silhouette dessinée plutôt qu'une image : un avion doit être détouré
            pour traverser un décor, et aucune de nos captures ne l'est. */}
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 text-foreground drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] sm:h-24 sm:w-24" fill="currentColor">
          <path d="M62 30.5c0-1.4-1-2.6-2.4-2.9l-15.4-3.1-9.8-16.8A2 2 0 0 0 32.7 6h-3.4a2 2 0 0 0-1.9 2.6l4.4 15.1-11.6-2.3-3.6-5.6a2 2 0 0 0-1.7-.9H12a2 2 0 0 0-1.9 2.5l2.4 8.9-2.4 8.9A2 2 0 0 0 12 47.7h2.9a2 2 0 0 0 1.7-.9l3.6-5.6 11.6-2.3-4.4 15.1a2 2 0 0 0 1.9 2.6h3.4a2 2 0 0 0 1.7-1l9.8-16.8 15.4-3.1c1.4-.3 2.4-1.5 2.4-2.9Z" />
        </svg>
      </div>
    </div>
  );
}
