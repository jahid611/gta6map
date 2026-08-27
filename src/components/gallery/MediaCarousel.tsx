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

/**
 * Hauteur de la carte active. Les autres en font la moitié, et c'est ce
 * contraste — non un cadre — qui désigne le plan courant.
 *
 * En unités absolues et non en pourcentage de la scène : la bande est à cheval
 * sur le bord bas de l'image, donc à moitié en dehors d'elle. Elle ne peut plus
 * se mesurer contre une hauteur dont elle sort.
 */
const CARD = "clamp(150px, 21vw, 300px)";

/** Part de la carte active qui descend sous le bord bas de l'image. */
const DROP = 0.56;
/**
 * Ce dont les petites cartes descendent en plus, en part de carte active.
 *
 * Elles partageaient exactement le bord haut de l'active et s'arrêtaient donc
 * pile au bord de l'image ; il leur fallait un peu de retombée elles aussi,
 * sans quoi la bande semblait tenir tout entière dans la photo.
 */
const SMALL_DROP = 0.1;

/**
 * Nombre de cartes chargées de part et d'autre de la carte active.
 *
 * La bande défile horizontalement : ses cartes hors champ le sont
 * latéralement, là où le chargement paresseux du navigateur ne prend aucune
 * avance. On charge donc soi-même de quoi couvrir plusieurs crans dans les deux
 * sens, ce qui suffit à ne jamais voir une carte se peindre.
 */
const STRIP_WINDOW = 8;

/**
 * Carrousel d'ouverture de la galerie, d'après `crafterui/hero-carousel`
 * (21st.dev) :
 *
 *  - une scène pleine largeur dont le fond est l'image active, servie telle
 *    quelle — ni voile, ni teinte, ni ombre : c'est la photo qu'on est venu
 *    voir, et tout ce qu'on pose dessus la dégrade ;
 *  - le titre calé juste au-dessus de la bande ;
 *  - **une seule bande** de cartes partageant le même bord supérieur, la carte
 *    active faisant deux fois la hauteur des autres, et la bande à cheval sur
 *    le bord bas de l'image : moitié sur la photo, moitié dans le vide en
 *    dessous.
 *
 * La bande défile horizontalement dès qu'elle déborde — c'est le cas courant,
 * la sélection suivant un filtre qui peut ramener des dizaines d'entrées — et
 * la carte active y est ramenée au centre à chaque changement.
 *
 * `framer-motion` est écarté comme partout ici : le glissement des cartes et la
 * montée du titre sont des transitions CSS.
 */
export function MediaCarousel({ entries, action }: { entries: MediaEntry[]; action?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const wheelAt = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const count = entries.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // La sélection a changé sous nos pieds (filtre) : le rang retenu ne désigne
  // plus la même image, et peut même être hors liste. Ajustement en phase de
  // rendu — un effet afficherait d'abord une image, puis sauterait.
  const [seen, setSeen] = useState(entries);
  if (seen !== entries) {
    setSeen(entries);
    setIndex(0);
  }

  // L'avance automatique s'arrête sur un clip : cinq secondes couperaient la
  // vidéo en pleine lecture. C'est alors au visiteur d'avancer.
  const onClip = entries[index]?.kind === "clip";

  useEffect(() => {
    if (paused || onClip || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), DELAY);
    return () => window.clearInterval(id);
  }, [paused, onClip, count, go]);

  // On ramène la carte active au centre de la piste. Calcul manuel plutôt que
  // `scrollIntoView` : celui-ci fait aussi défiler la page verticalement pour
  // amener la piste à l'écran, ce qui arracherait le lecteur à sa position.
  useEffect(() => {
    const strip = stripRef.current;
    const card = strip?.firstElementChild?.children[index] as HTMLElement | undefined;
    if (!strip || !card) return;
    const left = card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }, [index]);

  if (!count) return null;
  const active = entries[index];
  // Les deux plans voisins, chargés à l'avance dans le format exact de la scène
  // — le suivant parce que l'avance automatique y mène, le précédent parce
  // qu'une flèche y ramène. Sans cela, chaque changement rouvrait une requête
  // pleine largeur et l'on voyait la scène se peindre.
  // Les clips en sont exclus : précharger une vidéo pèse plusieurs mégaoctets
  // pour un plan qu'on ne verra peut-être pas. Son affiche suffit à l'ouvrir.
  const neighbours =
    count > 1
      ? [(index + 1) % count, (index - 1 + count) % count].filter((i) => entries[i].kind !== "clip")
      : [];

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
        // Au-dessus de la bande, la molette horizontale la fait défiler : c'est
        // le geste attendu, et le navigateur s'en charge mieux que nous.
        if (stripRef.current?.contains(e.target as Node)) return;
        // Ailleurs, elle change de plan. La verticale appartient à la page.
        if (Math.abs(e.deltaX) < WHEEL_THRESHOLD) return;
        if (e.timeStamp - wheelAt.current < WHEEL_COOLDOWN) return;
        wheelAt.current = e.timeStamp;
        go(e.deltaX > 0 ? 1 : -1);
      }}
      // Pas de rognage sur la section : la bande en déborde par le bas, et le
      // menu de la barre de commandes en déborde par le haut.
      // `z-30` : les vignettes de la grille sont positionnées, donc peintes
      // après la section faute de rang explicite — le menu déroulant de la
      // barre serait passé dessous.
      className="relative isolate z-30 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ paddingBottom: `calc(${CARD} * ${DROP})` }}
    >
      {/* La scène est au format natif des visuels — 3 840 × 2 160, soit 16:9 —
          et non en bandeau panoramique : au format 21:9, `object-cover` rognait
          le haut et le bas de chaque plan. Ici l'image est montrée en entier,
          et la scène y gagne en hauteur.

          Seul bloc rogné de la section : l'image doit s'arrêter net à son bord
          bas, c'est ce bord que la bande vient chevaucher. */}
      <div className="relative aspect-video w-full overflow-hidden">
        {active.kind === "clip" ? (
          // Un clip se joue, il ne se résume pas à son affiche. En `contain` et
          // non en `cover` : six des neuf clips officiels sont carrés — le
          // recadrage social de Rockstar — et les tailler au format du bandeau
          // leur retirerait le quart de chaque côté. Ils occupent donc la
          // hauteur de la scène, centrés, le fond de page tenant lieu de marge.
          <video
            key={active.src}
            src={active.src}
            poster={active.poster ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-contain animate-fade-in"
          />
        ) : (
          <Image
            key={active.src}
            src={active.src}
            alt=""
            aria-hidden
            fill
            priority
            quality={100}
            sizes="100vw"
            className="object-cover object-center animate-fade-in"
          />
        )}

        {/* Préchargement des voisins. `invisible` et non `hidden` : un élément
            retiré de la mise en page ne charge pas son image, alors qu'un
            élément simplement invisible la demande bel et bien. Mêmes `sizes`
            et même qualité que la scène, sans quoi le navigateur mettrait en
            cache une autre variante que celle réclamée à l'affichage. */}
        <div aria-hidden className="pointer-events-none invisible absolute inset-0">
          {neighbours.map((i) => (
            <Image
              key={entries[i].src}
              src={entries[i].poster ?? entries[i].src}
              alt=""
              fill
              loading="eager"
              // Priorité basse : ces deux-là ne servent qu'au coup d'après, et
              // ne doivent pas disputer la bande passante à la scène visible.
              fetchPriority="low"
              quality={100}
              sizes="100vw"
              className="object-cover"
            />
          ))}
        </div>

        {/* Titre, calé juste au-dessus de la bande. L'ombre portée est sur le
            texte, pas sur l'image : elle le rend lisible sur un ciel clair sans
            avoir à assombrir la photo. */}
        <div
          className="absolute inset-x-0 bottom-0 px-5 [text-shadow:0_2px_24px_rgba(0,0,0,0.75)] sm:px-8"
          style={{ paddingBottom: `calc(${CARD} * ${1 - DROP} + 1rem)` }}
        >
          <div className="flex w-full flex-wrap items-end gap-x-8 gap-y-1">
            <div className="min-w-0">
              <p className="vi-kicker text-accent">{active.group}</p>
              {/* Le titre monte depuis son propre bord : chaque changement le
                  remonte, ce qui marque le passage d'un plan à l'autre. */}
              <span className="mt-1 block overflow-hidden">
                <h2 key={active.id} className="rs-title block text-2xl leading-[0.95] text-white animate-title-up sm:text-5xl">
                  {active.title}
                </h2>
              </span>
            </div>
            <span className="vi-num ml-auto shrink-0 text-xs text-white/70">
              {index + 1} / {count}
            </span>
          </div>
        </div>
      </div>

      {/* Barre de commandes, hors de la scène : à l'intérieur, son rognage
          couperait le menu déroulant qu'elle accueille. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-5 pt-4 sm:px-8">
        <button type="button" onClick={() => go(-1)} aria-label="Plan précédent" className="rs-pill grid h-9 w-9 shrink-0 place-items-center cursor-pointer">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Plan suivant" className="rs-pill grid h-9 w-9 shrink-0 place-items-center cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </button>
        {/* Rail de progression : la barre dit où l'on en est dans la sélection,
            ce qu'un compteur seul ne montre pas. */}
        <span aria-hidden className="hidden h-0.5 w-1/5 overflow-hidden rounded-full bg-white/25 sm:block">
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${((index + 1) / count) * 100}%` }}
          />
        </span>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>

      {/* La bande, à cheval sur le bord bas de la scène : `bottom-0` vise le bas
          de la boîte de remplissage, soit une demi-carte plus bas que l'image.
          La carte active occupe toute la hauteur, donc moitié sur la photo,
          moitié dans le vide. */}
      <div
        ref={stripRef}
        className="vi-scroller absolute inset-x-0 bottom-0 z-10 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-5 sm:px-8"
        style={{ height: CARD }}
      >
        <ul className="flex h-full w-max items-start gap-2 sm:gap-3">
          {entries.map((entry, i) => {
            const focused = i === index;
            return (
              <li
                key={entry.id}
                className={cn(
                  "aspect-[3/4] shrink-0 transition-[height,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  focused ? "h-full" : "h-1/2",
                )}
                style={{ marginTop: focused ? 0 : `calc(${CARD} * ${SMALL_DROP})` }}
              >
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Voir ${entry.title}`}
                  aria-current={focused}
                  className={cn(
                    "group relative block h-full w-full overflow-hidden rounded-xl transition-opacity duration-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    focused ? "opacity-100" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <Image
                    src={entry.poster ?? entry.src}
                    alt=""
                    fill
                    // Qualité unique, et non relevée sur la carte active : la
                    // largeur demandée ne dépend pas du rang, si bien que
                    // changer de qualité au focus réclamait au serveur une
                    // seconde variante de la même image — un nouveau
                    // chargement, donc un clignotement, à chaque changement de
                    // plan. Une seule variante par carte, et le passage au
                    // premier plan ne coûte plus rien.
                    quality={90}
                    sizes="(max-width: 640px) 45vw, 320px"
                    loading={Math.abs(i - index) <= STRIP_WINDOW ? "eager" : "lazy"}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Une affiche de clip ne se distingue en rien d'une photo :
                      sans ce repère, on ne saurait pas qu'il y a une vidéo
                      derrière. Elle s'efface sur la carte active, qui joue
                      déjà. */}
                  {entry.kind === "clip" && !focused && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur-sm"
                    >
                      {/* Triangle en bordures CSS : un glyphe « play » d'une
                          fonte d'icônes serait optiquement décentré dans un
                          rond de cette taille. */}
                      <span className="ml-[2px] h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
