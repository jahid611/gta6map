"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MEDIA_FILTERS, countByFilter, type MediaEntry } from "@/lib/media-catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, X } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";

/**
 * Grille de médias avec filtres, chargement paresseux et visionneuse.
 *
 * Les vignettes se chargent en `loading="lazy"` et affichent un squelette
 * jusqu'à leur arrivée : sur 96 entrées dont certaines pèsent 2 Mo, tout
 * demander d'un coup bloquerait le rendu pour rien.
 */
export function MediaGrid({ entries }: { entries: MediaEntry[] }) {
  const [filter, setFilter] = useState("all");
  // On mémorise un RANG et non une entrée : la visionneuse doit pouvoir passer
  // au média suivant sans repasser par la grille.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Une vidéo ouverte en grand ne doit pas coexister avec neuf vignettes qui
  // décodent en arrière-plan : on les met toutes en pause à l'ouverture.
  useEffect(() => {
    if (openIndex === null) return;
    document.querySelectorAll<HTMLVideoElement>("video[data-gallery-video]").forEach((v) => v.pause());
  }, [openIndex]);

  const counts = useMemo(() => countByFilter(entries), [entries]);
  const active = MEDIA_FILTERS.find((f) => f.id === filter) ?? MEDIA_FILTERS[0];
  const shown = useMemo(() => entries.filter(active.match), [entries, active]);

  return (
    <>
      <div className="mb-8 flex justify-center">
        <Select
          label="Catégorie"
          value={filter}
          onChange={(id) => {
            setFilter(id);
            // La visionneuse retient un rang dans la sélection courante : changer
            // de catégorie sans la fermer ouvrirait un autre média.
            setOpenIndex(null);
          }}
          options={MEDIA_FILTERS.map((f) => ({
            value: f.id,
            label: f.label,
            count: counts[f.id],
            disabled: counts[f.id] === 0,
          }))}
        />
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((entry, i) => (
          <li key={entry.id} className="vi-reveal" data-reveal-delay={(i % 4) * 0.05}>
            <MediaTile entry={entry} onOpen={() => setOpenIndex(i)} />
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Aucun média dans cette catégorie.
        </p>
      )}

      {openIndex !== null && shown[openIndex] && (
        <Lightbox entries={shown} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}

function MediaTile({ entry, onOpen }: { entry: MediaEntry; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      onClick={onOpen}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Agrandir : ${entry.title}`}
    >
      {/* Une vidéo avec affiche a déjà quelque chose à montrer : le squelette
          ne concerne que les images en attente de chargement. */}
      {!loaded && !(entry.kind === "clip" && entry.poster) && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}

      {entry.kind === "clip" ? (
        // `poster` + `preload="none"` : la vignette s'affiche instantanément en
        // JPEG et le fichier vidéo n'est touché qu'au survol — neuf clips qui
        // réclameraient leurs métadonnées au chargement, c'est neuf connexions
        // pour des vidéos qu'on ne regardera peut-être jamais. Sans affiche, un
        // `<video preload="none">` n'a rien à peindre et reste vide.
        <video
          data-gallery-video
          src={entry.src}
          poster={entry.poster ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          onLoadedData={() => setLoaded(true)}
          onMouseEnter={(e) => {
            e.currentTarget.preload = "auto";
            void e.currentTarget.play().catch(() => {});
          }}
          onMouseLeave={(e) => e.currentTarget.pause()}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <Image
          src={entry.src}
          alt={entry.title}
          fill
          // Vignettes : on demande volontairement petit. Les originaux font 3 840 px
          // et plusieurs mégaoctets ; à 94 tuiles, réclamer une largeur généreuse
          // faisait attendre la grille plusieurs secondes.
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 320px"
          quality={75}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      {/* Pastille de lecture : signale qu'il s'agit d'une vidéo tant qu'on ne la
          survole pas. Elle s'efface pendant la lecture — le mouvement suffit
          alors à le dire — et revient dès que le curseur s'éloigne, y compris
          au retour de la visionneuse. En verre dépoli pour rester lisible aussi
          bien sur une affiche claire que sombre. */}
      {entry.kind === "clip" && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-300 group-hover:scale-90 group-hover:opacity-0"
        >
          {/* Triangle en bordures CSS : un glyphe « play » d'une fonte d'icônes
              serait optiquement décentré dans un rond de cette taille. */}
          <span className="ml-[3px] h-0 w-0 border-y-[7px] border-l-[12px] border-y-transparent border-l-white" />
        </span>
      )}

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8 text-left"
      >
        <span className="block truncate text-xs font-medium text-white">{entry.title}</span>
        <span className="block truncate text-[10px] text-white/60">{entry.group}</span>
      </span>
    </button>
  );
}

/**
 * Visionneuse plein écran. Fermeture au clic sur le fond ou à l'Échap,
 * navigation aux flèches (clavier ou boutons) dans la sélection courante.
 *
 * Les raccourcis sont posés sur `window` et non sur le conteneur : dès que la
 * lecture d'un clip démarre, le focus part sur les contrôles natifs de la vidéo
 * et un `onKeyDown` local ne reçoit plus rien.
 */
function Lightbox({
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
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/80"
      >
        <X className="h-4 w-4" />
      </button>

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
