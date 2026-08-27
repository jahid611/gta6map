"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, X } from "@/components/ui/icons";
import { mediaDownloadHref, type MediaEntry } from "@/lib/media-catalog";

/**
 * Visionneuse plein écran. Fermeture au clic sur le fond ou à l'Échap,
 * navigation aux flèches (clavier ou boutons) dans la sélection courante.
 *
 * Les raccourcis sont posés sur `window` et non sur le conteneur : dès que la
 * lecture d'un clip démarre, le focus part sur les contrôles natifs de la vidéo
 * et un `onKeyDown` local ne reçoit plus rien.
 */
export function MediaLightbox({
  entries,
  index,
  onIndex,
  onClose,
}: {
  entries: MediaEntry[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const entry = entries[index];
  const download = mediaDownloadHref(entry.src);
  const go = useCallback(
    (delta: number) => onIndex((index + delta + entries.length) % entries.length),
    [entries.length, index, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
      tabIndex={-1}
      onClick={onClose}
      ref={(el) => el?.focus()}
      // Pas de `backdrop-blur` ici. Un flou d'arrière-plan sur un élément plein
      // écran oblige le compositeur à refloutter toute la page derrière ; avec
      // une vidéo qui joue par-dessus, il le refait à chaque image. C'est ce qui
      // faisait saccader la lecture alors que le même fichier tourne sans
      // problème dans un onglet ou en vignette. Un aplat opaque suffit.
      className="fixed inset-0 z-[1400] grid place-items-center bg-[#07060d]/96 p-4"
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/80 cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Téléchargement, à gauche de la fermeture. `stopPropagation` : le fond
          se ferme au clic, et sans cela le lien fermerait la visionneuse au
          moment même où il déclenche l'enregistrement. */}
      {download && (
        <a
          href={download}
          download
          onClick={(e) => e.stopPropagation()}
          aria-label={`Télécharger : ${entry.title}`}
          className="absolute right-16 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/80 cursor-pointer"
        >
          <Download className="h-4 w-4" />
        </a>
      )}

      {entries.length > 1 && (
        <>
          {/* Ancrées aux bords de l'écran, hors du cadre du média : superposées à
              l'image, elles masqueraient justement ce qu'on est venu regarder. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Média précédent"
            className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/80 sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Média suivant"
            className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/80 sm:right-4"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* `key` : sans remontage, passer d'un clip au suivant réutiliserait le
          même <video>, qui garde la position de lecture du précédent. */}
      <figure key={entry.id} className="max-h-full w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        {entry.kind === "clip" ? (
          <video
            src={entry.src}
            poster={entry.poster ?? undefined}
            controls
            autoPlay
            loop
            playsInline
            preload="auto"
            className="max-h-[80vh] w-full rounded-xl bg-black"
          />
        ) : (
          // Deux couches : dessous la vignette déjà en cache depuis la grille,
          // affichée instantanément et floutée ; dessus la version pleine taille
          // qui se fond une fois arrivée. Sans cela, le clic ouvrait un cadre
          // vide le temps que Next génère la variante haute résolution.
          <span className="relative block max-h-[80vh] w-full">
            <Image
              src={entry.src}
              alt=""
              aria-hidden
              width={1600}
              height={900}
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="max-h-[80vh] w-full rounded-xl object-contain blur-[2px]"
            />
            <Image
              src={entry.src}
              alt={entry.title}
              fill
              quality={88}
              sizes="(max-width: 1600px) 100vw, 1600px"
              onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
              className="rounded-xl object-contain opacity-0 transition-opacity duration-300"
            />
          </span>
        )}
        <figcaption className="mt-3 text-center text-sm text-white/70">
          {entry.title}
          <span className="mx-2 opacity-40">·</span>
          {entry.group}
          {entries.length > 1 && (
            <>
              <span className="mx-2 opacity-40">·</span>
              <span className="vi-num opacity-60">
                {index + 1} / {entries.length}
              </span>
            </>
          )}
        </figcaption>
      </figure>
    </div>
  );
}
