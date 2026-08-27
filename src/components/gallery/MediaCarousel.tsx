"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import type { MediaEntry } from "@/lib/media-catalog";
import { cn } from "@/lib/utils";

/** Cadence de l'avance automatique, en millisecondes. */
const DELAY = 5000;
const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN = 420;

/* Proportions de la composition d'origine, toutes rapportées à la scène. */
/** Haut commun de la bande, en descendant depuis le sommet. */
const STRIP_TOP = 0.5;
/** Hauteur d'une carte au repos, rapportée à la scène. L'active fait le double. */
const CARD_H = 0.264;

/**
 * Carrousel d'ouverture de la galerie, d'après `crafterui/hero-carousel`
 * (21st.dev), dont la composition est reprise telle quelle :
 *
 *  - une scène pleine largeur, dont le fond est l'image active graduée — c'est
 *    lui qui fait basculer l'ambiance à chaque changement ;
 *  - le titre occupe la moitié haute, calé en bas de celle-ci, donc juste
 *    au-dessus de la bande ;
 *  - **une seule bande** qui démarre à mi-hauteur, toutes les cartes partageant
 *    ce même bord supérieur, la carte active faisant deux fois la hauteur des
 *    autres. C'est ce contraste de hauteur qui désigne le plan courant, sans
 *    cadre ni pastille.
 *
 * Les proportions sont celles de l'original, rapportées à la hauteur de scène.
 *
 * `framer-motion` est écarté comme partout ici : le glissement des cartes et la
 * montée du titre sont des transitions CSS.
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

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Plans à la une"
      tabIndex={0}
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
        // Molette horizontale seulement : la verticale appartient à la page.
        if (Math.abs(e.deltaX) < WHEEL_THRESHOLD) return;
        if (e.timeStamp - wheelAt.current < WHEEL_COOLDOWN) return;
        wheelAt.current = e.timeStamp;
        go(e.deltaX > 0 ? 1 : -1);
      }}
      // Pleine largeur, sans arrondi ni marge : la scene occupe toute la fenetre,
      // comme dans l original. Elle est donc rendue hors de la colonne de la page.
      className="relative isolate aspect-[16/10] w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:aspect-[21/9]"
    >
      {/* Fond de scène : l'image active en pleine définition, telle quelle. Elle
          n'est ni floutée ni réduite — c'est elle le décor, et l'original la
          gradue sans lui retirer sa netteté. Seuls des voiles dégradés viennent
          asseoir le titre en haut et la bande en bas. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          key={active.src}
          src={active.poster ?? active.src}
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center animate-fade-in"
        />
        {/* Teinte rose posée en `color` : la photo garde sa luminance et prend la
            couleur de la charte, ce que l'original appelle sa gradation. */}
        <div className="absolute inset-0 bg-accent/12 mix-blend-color" />
        {/* La moitié basse est nettement assombrie : le fond étant la même image
            que la carte active, celle-ci s'y dissolvait faute de contraste. Le
            haut reste clair, c'est là que le décor se donne à voir. */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 via-45% to-background/92" />
      </div>

      {/* Moitié haute : le titre, calé en bas — donc juste au-dessus de la bande. */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col justify-end px-5 pb-4 sm:px-8"
        style={{ height: `${STRIP_TOP * 100}%` }}
      >
        <div className="flex w-full flex-wrap items-end gap-x-8 gap-y-1">
          <div className="min-w-0">
            <p className="vi-kicker text-accent">{active.group}</p>
            {/* Le titre monte depuis son propre bord : chaque changement le
                remonte, ce qui marque le passage d'un plan à l'autre. */}
            <span className="mt-1 block overflow-hidden">
              <h2 key={active.id} className="rs-title block text-2xl leading-[0.95] text-foreground animate-title-up sm:text-5xl">
                {active.title}
              </h2>
            </span>
          </div>
          <span className="vi-num ml-auto shrink-0 text-xs text-muted">
            {index + 1} / {count}
          </span>
        </div>
      </div>

      {/* La bande : un seul rang, haut commun, carte active deux fois plus haute.
          Le conteneur occupe la moitié basse, les hauteurs s'expriment donc en
          pourcentage de cette moitié — d'où le doublement des ratios d'origine.
          La largeur suit par le format 3:4, sans avoir à la calculer. */}
      <div className="absolute inset-x-0 overflow-hidden px-5 sm:px-8" style={{ top: `${STRIP_TOP * 100}%`, height: `${(1 - STRIP_TOP) * 100}%` }}>
        {/* `h-full` indispensable : les hauteurs des cartes sont en pourcentage,
            et un pourcentage ne se résout que contre un parent de hauteur
            connue. Sans lui la liste tombait à zéro et la bande disparaissait. */}
        <ul className="flex h-full items-start gap-2 sm:gap-3">
          {entries.map((entry, i) => {
            const focused = i === index;
            return (
              <li
                key={entry.id}
                className="aspect-[3/4] shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ height: `${((focused ? CARD_H * 2 : CARD_H) / (1 - STRIP_TOP)) * 100}%` }}
              >
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Voir ${entry.title}`}
                  aria-current={focused}
                  className={cn(
                    "group relative block h-full w-full overflow-hidden rounded-xl transition-opacity duration-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    focused ? "opacity-100" : "opacity-55 hover:opacity-90",
                  )}
                >
                  <Image
                    src={entry.poster ?? entry.src}
                    alt=""
                    fill
                    quality={focused ? 92 : 70}
                    sizes="(max-width: 640px) 45vw, 420px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Aucune légende sur les cartes : la carte active déborde
                      volontairement du bas de la scène, et tout texte posé sur
                      elle s'y ferait rogner. Le titre au-dessus la nomme déjà. */}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Commandes en tête de scène, comme la barre supérieure de l'original :
          en pied, la carte active — qui déborde volontairement vers le bas — les
          aurait recouvertes. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-5 pt-4 sm:px-8">
        <button type="button" onClick={() => go(-1)} aria-label="Plan précédent" className="rs-pill grid h-9 w-9 shrink-0 place-items-center cursor-pointer">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Plan suivant" className="rs-pill grid h-9 w-9 shrink-0 place-items-center cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </button>
        {/* Rail de progression : la barre dit où l'on en est dans la sélection,
            ce qu'un compteur seul ne montre pas. */}
        <span aria-hidden className="h-0.5 w-1/5 overflow-hidden rounded-full bg-white/15">
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${((index + 1) / count) * 100}%` }}
          />
        </span>
      </div>
    </section>
  );
}
