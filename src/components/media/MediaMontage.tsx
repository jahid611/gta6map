"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface MontageItem {
  id: string;
  kind: "video" | "image";
  src: string;
  poster?: string | null;
  title: string;
  subtitle?: string;
}

interface MediaMontageProps {
  items: MontageItem[];
  /** Durée d'affichage d'un élément (ms) — les clips Rockstar durent ~1 s et bouclent. */
  interval?: number;
  className?: string;
  /** `true` : occupe tout son conteneur (panneau plein écran), sans ratio imposé. */
  fill?: boolean;
}

/**
 * Montage auto : enchaîne clips (en boucle, muets) et images avec un fondu,
 * navigation flèches / points / clavier, pause au survol.
 */
export function MediaMontage({ items, interval = 4500, className, fill = false }: MediaMontageProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const count = items.length;

  const go = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);

  // Les images avancent au bout de `interval` ; les clips (≈ 1 s) avancent à leur fin
  // (`onEnded`) et ne sont jamais rejoués — un clip d'une seconde en boucle fait moche.
  useEffect(() => {
    if (paused || count < 2 || items[index]?.kind === "video") return;
    const t = setTimeout(() => go(1), interval);
    return () => clearTimeout(t);
  }, [index, paused, count, interval, go, items]);

  // `muted` n'est pas sérialisé par React côté serveur : sans ce rappel, la
  // lecture automatique est refusée sur une page rendue au serveur.
  useEffect(() => {
    for (const v of videoRefs.current) if (v) { v.muted = true; v.defaultMuted = true; }
  }, [items]);

  // Lecture du clip courant uniquement (les autres restent en pause pour économiser CPU/réseau).
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        void v.play().catch(() => {});
      } else v.pause();
    });
  }, [index]);

  // Reprise après pause sur un clip déjà terminé : on passe au suivant plutôt que de le rejouer.
  useEffect(() => {
    if (paused) return;
    const v = videoRefs.current[index];
    if (v && v.ended && count > 1) go(1);
  }, [paused, index, count, go]);

  if (!count) return null;
  const current = items[index];

  return (
    <div
      className={cn("group relative overflow-hidden bg-black", fill ? "h-full w-full" : "rounded-3xl", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      tabIndex={0}
      aria-roledescription="carrousel"
      aria-label="Montage des médias officiels"
    >
      <div className={cn("relative w-full", fill ? "h-full" : "aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]")}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={cn("absolute inset-0 transition-opacity duration-700", i === index ? "opacity-100" : "opacity-0")}
            aria-hidden={i !== index}
          >
            {item.kind === "video" ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={item.src}
                poster={item.poster ?? undefined}
                muted
                playsInline
                preload={i === index ? "auto" : "metadata"}
                onEnded={() => {
                  // Joué une seule fois : on enchaîne (ou on reste sur la dernière image si en pause).
                  if (i === index && !paused && count > 1) go(1);
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={item.title} className="h-full w-full object-cover" loading={i === index ? "eager" : "lazy"} />
            )}
          </div>
        ))}
        {/* Même voile et même légende que le panneau de la page de connexion. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent lg:bg-gradient-to-r lg:from-background lg:via-background/10 lg:to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 lg:bottom-12 lg:left-12">
          <p className="vi-kicker text-accent-pale">Leonida, USA</p>
          <p className="font-display mt-2 max-w-md text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-3xl">
            {current.title}
          </p>
          <p className="mt-2 text-xs text-white/60">
            {current.subtitle ?? (current.kind === "video" ? "Clip officiel" : "Screenshot officiel")} — © Rockstar Games
          </p>
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
            aria-label="Suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-1" role="tablist">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.title}
                onClick={() => setIndex(i)}
                className={cn("h-1 rounded-full transition-all cursor-pointer", i === index ? "w-6 bg-accent" : "w-2.5 bg-white/40 hover:bg-white/70")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
