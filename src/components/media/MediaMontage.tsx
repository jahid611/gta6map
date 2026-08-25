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

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => go(1), interval);
    return () => clearTimeout(t);
  }, [index, paused, count, interval, go]);

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
                loop
                playsInline
                preload={i === index ? "auto" : "metadata"}
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={item.title} className="h-full w-full object-cover" loading={i === index ? "eager" : "lazy"} />
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="vi-kicker text-accent-pale">{current.kind === "video" ? "Clip officiel" : "Screenshot officiel"}</p>
          <p className="font-display mt-1 text-xl font-extrabold leading-tight text-white drop-shadow">{current.title}</p>
          {current.subtitle && <p className="text-xs text-white/70">{current.subtitle}</p>}
        </div>
        <p className="absolute right-3 top-3 text-[10px] text-white/50">© Rockstar Games</p>
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
