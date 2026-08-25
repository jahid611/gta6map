"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";

interface CarouselProps {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  id?: string;
  /** Délai du défilement automatique (ms). 0 pour le désactiver. */
  autoplayMs?: number;
  children: React.ReactNode;
}

/**
 * Carrousel horizontal partagé par « Plans officiels » et « Régions ».
 *
 * Le défilement reste natif (`overflow-x: auto` + `scroll-snap`) plutôt que
 * piloté par une piste transformée en JS : molette horizontale, glissé tactile,
 * navigation clavier et `scrollIntoView` du focus fonctionnent alors sans code,
 * et il n'y a rien à recalculer au redimensionnement. Les flèches et l'avance
 * automatique se contentent d'appeler `scrollBy` / `scrollTo`.
 *
 * La piste est contenue dans la même colonne que le reste de la page et centrée,
 * les flèches débordant de part et d'autre.
 */
export function Carousel({ kicker, title, lead, id, autoplayMs = 4200, children }: CarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /** Suspend l'avance auto : survol, focus clavier, ou onglet en arrière-plan. */
  const [paused, setPaused] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // Marge d'1 px : les navigateurs renvoient des positions fractionnaires et
    // `scrollLeft + clientWidth` n'atteint jamais exactement `scrollWidth`.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  /** Largeur d'un cran : la carte + l'espacement, lue sur le premier enfant. */
  const step = () => {
    const el = trackRef.current;
    const card = el?.firstElementChild as HTMLElement | null;
    return card ? card.getBoundingClientRect().width + 20 : (el?.clientWidth ?? 0) * 0.8;
  };

  /**
   * Défilement animé maison plutôt que `behavior: "smooth"`.
   *
   * Le lissage natif applique une courbe plate et une durée imposée par le
   * navigateur : au clic sur une flèche, les cartes semblent glisser d'un bloc.
   * On anime donc `scrollLeft` nous-mêmes sur une exponentielle sortante, qui
   * démarre franchement et se pose en douceur.
   *
   * `animRef` garde la frame en cours pour qu'un second clic reprenne la main
   * au lieu de lutter contre l'animation précédente.
   */
  const animRef = useRef<number | null>(null);

  const animateTo = useCallback((target: number) => {
    const el = trackRef.current;
    if (!el) return;
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const from = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const to = Math.max(0, Math.min(max, target));
    const distance = to - from;
    if (Math.abs(distance) < 1) return;

    // Durée liée à la distance, bornée : un cran reste vif, un retour au début
    // (plusieurs cartes d'un coup) ne dure pas non plus une seconde et demie.
    const duration = Math.min(900, Math.max(420, Math.abs(distance) * 0.75));
    const start = performance.now();
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      el.scrollLeft = from + distance * easeOutExpo(t);
      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  }, []);

  const scrollByCard = useCallback(
    (direction: 1 | -1) => {
      const el = trackRef.current;
      if (!el) return;
      animateTo(el.scrollLeft + step() * direction);
    },
    [animateTo],
  );

  // Avance automatique. Revient au début une fois la fin atteinte plutôt que de
  // s'arrêter : un carrousel qui se fige au bout donne l'impression d'être cassé.
  useEffect(() => {
    if (!autoplayMs) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (paused) return;

    const id = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
        animateTo(0);
      } else {
        animateTo(el.scrollLeft + step());
      }
    }, autoplayMs);

    return () => window.clearInterval(id);
  }, [autoplayMs, paused, animateTo]);

  // Onglet masqué : inutile de faire défiler dans le vide (et le `scrollBy`
  // « smooth » s'y comporte mal au retour).
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const arrow =
    "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-background/70 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-accent/60 hover:bg-background/90 hover:text-accent disabled:pointer-events-none disabled:opacity-0 lg:grid";

  return (
    <section id={id} className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="vi-reveal mx-auto max-w-2xl text-center">
          <p className="vi-kicker text-accent">{kicker}</p>
          <h2 className="vi-display mt-5 text-[clamp(2rem,5.5vw,3.75rem)]">{title}</h2>
          {lead && <p className="mt-5 text-base leading-relaxed text-muted">{lead}</p>}
        </div>
      </div>

      <div
        className="group/carousel relative mx-auto mt-12 max-w-6xl px-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <button
          className={`${arrow} -left-2 xl:-left-7`}
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="Voir les éléments précédents"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* `scroll-pl` doit reprendre le rembourrage : sans lui, l'accrochage
            aligne le bord de la première carte sur celui du conteneur et annule
            le rembourrage, ce qui la rogne. */}
        <ul
          ref={trackRef}
          className="vi-scroller flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-pl-5 pb-4"
          style={{ scrollBehavior: "auto" }}
        >
          {children}
        </ul>

        <button
          className={`${arrow} -right-2 xl:-right-7`}
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="Voir les éléments suivants"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Fondus latéraux : signalent qu'il reste des cartes hors cadre, et
            évitent la coupe nette au bord de la piste. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-5 z-10 w-16 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 ${atStart ? "opacity-0" : "opacity-100"}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-5 z-10 w-16 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 ${atEnd ? "opacity-0" : "opacity-100"}`}
        />
      </div>
    </section>
  );
}
