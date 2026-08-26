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
 * éléments ajoutés APRÈS le montage (changement de filtre dans la galerie…)
 * sont détectés par un MutationObserver et armés à leur tour.
 *
 * ⚠ Piège : `ScrollTrigger.refresh()` insère lui-même des nœuds dans le DOM
 * (les `pin-spacer` du hero épinglé). Rafraîchir dès qu'un nœud apparaît créait
 * donc une boucle infinie — mutation → refresh → mutation → … — qui figeait la
 * page. On ne rafraîchit que si un `.vi-reveal` INÉDIT a été armé, l'observateur
 * est débranché pendant le refresh, et le tout est reporté d'une frame.
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
    let frame = 0;

    const arm = (el: HTMLElement): boolean => {
      if (armed.has(el) || el.classList.contains("is-in")) return false;
      armed.add(el);
      // Déjà à l'écran au moment où on l'arme (changement de filtre dans la
      // galerie, liste re-rendue) : on l'affiche tout de suite. Un ScrollTrigger
      // n'aurait plus de seuil à franchir, et la vignette serait restée à
      // opacité zéro — une grille de 36 éléments paraissait vide.
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add("is-in");
        return true;
      }
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
      return true;
    };

    /** Retourne le nombre d'éléments NOUVELLEMENT armés. */
    const armAll = (scope: ParentNode): number => {
      let n = 0;
      for (const el of scope.querySelectorAll<HTMLElement>(".vi-reveal")) if (arm(el)) n += 1;
      if (scope instanceof HTMLElement && scope.classList.contains("vi-reveal") && arm(scope)) n += 1;
      return n;
    };

    armAll(root);

    const observer = new MutationObserver((mutations) => {
      let fresh = 0;
      for (const m of mutations) {
        for (const node of m.addedNodes) if (node instanceof HTMLElement) fresh += armAll(node);
      }
      if (!fresh || frame) return;
      // Débranché pendant le refresh : celui-ci réinsère les pin-spacers et
      // relancerait sinon ce même callback en boucle.
      frame = requestAnimationFrame(() => {
        frame = 0;
        observer.disconnect();
        ScrollTrigger.refresh();
        observer.observe(root, { childList: true, subtree: true });
      });
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      for (const t of triggers) t.kill();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
