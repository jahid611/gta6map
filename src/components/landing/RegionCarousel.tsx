"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/components/ui/icons";
import type { LandingRegion } from "@/lib/landing-stats";
import { cn } from "@/lib/utils";

/**
 * Les régions de Leonida, une à la fois.
 *
 * Reprend la composition d'un carrousel de profils (21st.dev,
 * `arunachalam/profile-card-testimonial-carousel`) : un grand visuel carré, et
 * un panneau qui vient mordre dessus sur sa gauche. Adapté à notre charte —
 * l'original arrivait en tokens shadcn (`bg-white dark:bg-card`) et en
 * `framer-motion`, remplacé ici par nos variables et un simple fondu CSS ; une
 * dépendance d'animation de 50 ko pour un changement d'opacité ne se justifie
 * pas quand GSAP est déjà chargé pour le hero.
 *
 * Un seul niveau de carte : le visuel n'est pas encadré, seul le panneau l'est.
 */
export function RegionCarousel({ regions }: { regions: LandingRegion[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = regions.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Avance automatique, au même rythme que les autres carrousels du site.
  // Suspendue au survol, au focus clavier et sous `prefers-reduced-motion`.
  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), 6000);
    return () => window.clearInterval(id);
  }, [paused, count, go]);

  if (!count) return null;
  const region = regions[index];

  return (
    <section id="regions" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="vi-reveal mx-auto max-w-2xl text-center">
          <p className="vi-kicker text-accent">L&apos;État de Leonida</p>
          <h2 className="vi-display mt-5 text-[clamp(2rem,5.5vw,3.75rem)]">
            Huit régions,
            <br />
            une seule carte
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Des néons de Vice City aux marécages de Mount Kalaga. Chaque point est positionné en coordonnées monde
            (mètres RAGE), pas approximé à la main sur une capture d&apos;écran.
          </p>
        </div>
      </div>

      <div
        className="vi-reveal mx-auto mt-14 max-w-6xl px-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        // Glissé horizontal au doigt : sur téléphone les flèches sont loin des
        // pouces, et le geste est ce qu'on essaie d'abord sur un visuel plein
        // écran. Seuil à 48 px pour ne pas déclencher sur un défilement vertical.
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
        }}
      >
        <div className="flex flex-col items-center md:flex-row md:items-center">
          {/* Visuel. `key` sur l'image : c'est ce qui relance le fondu à chaque
              changement de région, sans machine à états d'animation. */}
          <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-3xl bg-surface-2 sm:max-w-md md:w-[23rem] lg:w-[28rem]">
            {region.image ? (
              <Image
                key={region.image}
                src={region.image}
                alt={region.name}
                fill
                priority={index === 0}
                quality={92}
                sizes="(max-width: 768px) 92vw, 27rem"
                className="animate-fade-in object-cover object-center"
                draggable={false}
              />
            ) : (
              <span aria-hidden className="absolute inset-0 bg-[image:var(--gradient-vi)] opacity-20" />
            )}
            {/* Voile bas : sur téléphone le panneau chevauche le visuel par le
                haut, et le texte passerait sinon sur une zone claire. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent md:hidden"
            />
          </div>

          {/* Panneau. Il mord sur le visuel — par la gauche sur grand écran, par
              le haut sur téléphone où l'empilement est vertical. */}
          {/* `flex-1` sans largeur maximale : borné à `max-w-xl`, le bloc
              s'arrêtait bien avant le bord de la colonne et l'ensemble semblait
              calé à gauche. C'est le texte qui est borné, pas le panneau. */}
          <div className="rs-card relative z-10 -mt-16 w-[92%] rounded-3xl p-6 sm:w-[88%] md:-ml-20 md:mt-0 md:w-auto md:min-w-0 md:flex-1 md:p-10">
            <div key={region.slug} className="animate-fade-in md:max-w-2xl md:pl-6">
              <p className="vi-kicker text-accent-pale">Région</p>
              <h3 className="rs-title mt-2 text-2xl leading-tight text-foreground md:text-3xl">{region.name}</h3>

              <p className="vi-num mt-3 text-sm text-accent">
                {region.count.toLocaleString("fr-FR")} lieux répertoriés
              </p>

              {region.blurb && (
                <p className="mt-5 text-sm leading-relaxed text-muted md:text-base">{region.blurb}</p>
              )}

              {region.districts.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="vi-kicker text-[10px] text-muted">Quartiers</p>
                  {/* Texte simple séparé par des points : ce sont des libellés,
                      pas des actions — les enfermer dans des pastilles ferait
                      croire qu'on peut cliquer dessus. */}
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {region.districts.map((d, i) => (
                      <span key={d}>
                        {i > 0 && <span className="mx-2 text-muted opacity-50">·</span>}
                        {d}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              <Link
                href={region.href}
                className="group mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.03] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Explorer {region.name}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Région précédente"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-2 text-foreground transition-colors hover:border-accent/60 hover:text-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Sur téléphone, huit puces à 44 px de cible tactile font 350 px à
              elles seules : avec les deux flèches, la rangée dépassait la
              largeur de l'écran et décalait toute la page vers la droite. Le
              rang y est donc écrit, et les puces reviennent dès qu'il y a la
              place. */}
          <span className="vi-num text-sm text-muted sm:hidden">
            <span className="text-foreground">{index + 1}</span> / {count}
          </span>

          <div className="hidden items-center sm:flex">
            {regions.map((r, i) => (
              // La cible tactile fait 44 px (imposé sur mobile par `globals.css`),
              // la pastille visible reste fine : c'est le <span> qui est peint,
              // pas le bouton — sinon la puce virait au gros carré au doigt.
              <button
                key={r.slug}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Voir ${r.name}`}
                aria-current={i === index}
                className="grid h-8 w-8 place-items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    i === index ? "w-6 bg-accent" : "w-1.5 bg-border-strong",
                  )}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Région suivante"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-2 text-foreground transition-colors hover:border-accent/60 hover:text-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
