"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Moteur d'apparition au scroll de la landing et de la galerie.
 *
 * Pose `data-reveal="on"` sur son conteneur au montage : c'est cet attribut qui
 * arme l'état masqué de `.vi-reveal` (cf. globals.css). Sans JS, l'attribut
 * n'existe jamais et la page reste entièrement lisible — pas de contenu invisible.
 *
 * Chaque `.vi-reveal` reçoit `.is-in` quand il entre dans le viewport. Les
 * éléments ajoutés APRÈS le montage (changement de filtre dans la galerie,
 * liste re-rendue par React…) sont détectés par un MutationObserver et armés à
 * leur tour — sinon ils resteraient masqués à jamais.
 */
export function RevealProvider({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.dataset.reveal = "on";

    // Animations refusées : le CSS force l'état visible, rien à ordonnancer.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const armed = new WeakSet<Element>();
    const triggers: ScrollTrigger[] = [];

    const arm = (el: HTMLElement) => {
      if (armed.has(el) || el.classList.contains("is-in")) return;
      armed.add(el);
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: "top 92%",
          once: true,
          onEnter: () => {
            const delay = Number(el.dataset.revealDelay ?? 0);
            gsap.delayedCall(delay, () => el.classList.add("is-in"));
          },
        }),
      );
    };

    const armAll = (scope: ParentNode) => {
      for (const el of scope.querySelectorAll<HTMLElement>(".vi-reveal")) arm(el);
      if (scope instanceof HTMLElement && scope.classList.contains("vi-reveal")) arm(scope);
    };

    armAll(root);

    // Nouveaux `.vi-reveal` insérés plus tard (filtres, pagination…).
    const observer = new MutationObserver((mutations) => {
      let added = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            armAll(node);
            added = true;
          }
        }
      }
      // Les positions ont changé : ScrollTrigger doit recalculer ses bornes.
      if (added) ScrollTrigger.refresh();
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      for (const t of triggers) t.kill();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
