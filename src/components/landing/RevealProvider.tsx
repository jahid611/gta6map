"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Moteur d'apparition au scroll de la landing.
 *
 * Pose `data-reveal="on"` sur son conteneur au montage : c'est cet attribut qui
 * arme l'état masqué de `.vi-reveal` (cf. globals.css). Sans JS, l'attribut
 * n'existe jamais et la page reste entièrement lisible — pas de contenu invisible.
 *
 * Chaque `.vi-reveal` reçoit ensuite `.is-in` quand il entre dans le viewport.
 * On passe par une classe plutôt que par `gsap.to()` pour que la transition soit
 * décrite en CSS : ScrollTrigger ne fait qu'ordonnancer, et `prefers-reduced-motion`
 * la neutralise sans code JS conditionnel.
 */
export function RevealProvider({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.dataset.reveal = "on";

    // Rien à ordonnancer si l'utilisateur refuse les animations : le CSS force
    // déjà l'état visible, inutile de créer 20 ScrollTriggers.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      for (const el of gsap.utils.toArray<HTMLElement>(".vi-reveal")) {
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => {
            // Léger décalage en cascade entre frères, pour éviter l'effet « tout
            // apparaît d'un bloc » sur les grilles.
            const delay = Number(el.dataset.revealDelay ?? 0);
            gsap.delayedCall(delay, () => el.classList.add("is-in"));
          },
        });
      }
    }, root);

    return () => ctx.revert();
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
