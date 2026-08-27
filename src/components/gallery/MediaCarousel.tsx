"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import type { MediaEntry } from "@/lib/media-catalog";
import { cn } from "@/lib/utils";

/** Cadence de l'avance automatique, en millisecondes. */
const DELAY = 5000;
/** Amplitude de molette au-delà de laquelle on change de plan. */
const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN = 420;

/**
 * Carrousel d'ouverture de la galerie, d'après `crafterui/hero-carousel`
 * (21st.dev) : un plan en grand, la suite en bande sous lui, et le fond de scène
 * qui reprend l'image active en très flou — c'est ce fond qui fait basculer
 * l'ambiance à chaque changement.
 *
 * Trois choses reprises de l'original, parce qu'elles font l'essentiel :
 *
 *  - le fond dérivé de l'image active, non un aplat ;
 *  - la bande des plans suivants, qui annonce ce qui vient au lieu de laisser
 *    l'utilisateur découvrir à l'aveugle ;
 *  - la molette comme moyen de navigation, avec un seuil et un temps mort —
 *    sans quoi un seul geste de trackpad ferait défiler dix plans.
 *
 * `framer-motion` est écarté, comme partout ailleurs ici : les transitions sont
 * des changements d'opacité et de position, ce que le CSS fait seul.
 */
export function MediaCarousel({ entries }: { entries: MediaEntry[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const wheelAt = useRef(0);
  const count = entries.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), DELAY);
    return () => window.clearInterval(id);
  }, [paused, count, go]);

  if (!count) return null;
  const active = entries[index];
  /** Les trois plans suivants, en boucle : la bande annonce la suite. */
  const strip = Array.from({ length: Math.min(4, count) }, (_, k) => entries[(index + k) % count]);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Plans à la une"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
        else return;
        e.preventDefault();
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaX) < WHEEL_THRESHOLD) return;
        const now = e.timeStamp;
        if (now - wheelAt.current < WHEEL_COOLDOWN) return;
        wheelAt.current = now;
        go(e.deltaX > 0 ? 1 : -1);
      }}
      tabIndex={0}
      className="relative isolate mb-14 overflow-hidden rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Fond de scène : l'image active, agrandie et très floutée. Elle change en
          même temps que le plan, ce qui fait basculer la couleur de toute la
          section — l'effet que porte l'original. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          key={active.src}
          src={active.poster ?? active.src}
          alt=""
          fill
          quality={35}
          sizes="100vw"
          className="scale-110 object-cover opacity-45 blur-2xl animate-fade-in"
        />
        <div className="absolute inset-0 bg-background/55" />
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-8 lg:flex-row lg:items-end lg:gap-10">
        {/* Plan actif */}
        <div className="min-w-0 lg:w-[58%]">
          <p className="vi-kicker text-accent">{active.group}</p>
          <h2 className="rs-title mt-2 text-2xl leading-tight text-foreground sm:text-4xl">{active.title}</h2>

          <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl">
            <Image
              key={active.id}
              src={active.poster ?? active.src}
              alt={active.title}
              fill
              priority
              quality={90}
              sizes="(max-width: 1024px) 100vw, 1100px"
              className="object-cover animate-fade-in"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Plan précédent"
              className="rs-pill grid h-10 w-10 place-items-center cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Plan suivant"
              className="rs-pill grid h-10 w-10 place-items-center cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Rail de progression, comme dans l'original : la barre dit où l'on
                en est dans la sélection, ce qu'un compteur seul ne montre pas. */}
            <span aria-hidden className="ml-2 h-0.5 flex-1 overflow-hidden rounded-full bg-white/12">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${((index + 1) / count) * 100}%` }}
              />
            </span>
            <span className="vi-num shrink-0 text-xs text-muted">
              {index + 1} / {count}
            </span>
          </div>
        </div>

        {/* La bande : ce qui vient ensuite. Masquée sous `lg`, où elle prendrait
            la place du plan lui-même. */}
        <ul className="hidden gap-3 lg:flex lg:w-[42%]">
          {strip.map((entry, k) => (
            <li key={`${entry.id}-${k}`} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => go(k)}
                aria-label={`Voir ${entry.title}`}
                aria-current={k === 0}
                className={cn(
                  "group relative block aspect-[3/4] w-full overflow-hidden rounded-xl transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  k === 0 ? "opacity-100 ring-1 ring-accent/50" : "opacity-55 hover:opacity-90",
                )}
              >
                <Image
                  src={entry.poster ?? entry.src}
                  alt=""
                  fill
                  quality={70}
                  sizes="200px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-left">
                  <span className="block truncate text-[11px] font-medium text-white">{entry.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
