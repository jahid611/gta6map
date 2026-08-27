"use client";

import { useState } from "react";
import Image from "next/image";
import { type MediaEntry } from "@/lib/media-catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNearViewport } from "@/hooks/useNearViewport";

/**
 * Grille de médias, en chargement paresseux.
 *
 * La sélection lui arrive déjà filtrée : le choix de catégorie est remonté au
 * carrousel, qu'il commande aussi. La visionneuse l'est également — le
 * carrousel l'ouvre lui aussi, et deux exemplaires sur la même page se
 * disputeraient les raccourcis clavier (cf. `GalleryView`).
 *
 * Les vignettes se chargent en `loading="lazy"` et affichent un squelette
 * jusqu'à leur arrivée : sur 96 entrées dont certaines pèsent 2 Mo, tout
 * demander d'un coup bloquerait le rendu pour rien.
 */
export function MediaGrid({ entries, onOpen }: { entries: MediaEntry[]; onOpen: (index: number) => void }) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry, i) => (
          <li key={entry.id} className="vi-reveal" data-reveal-delay={(i % 4) * 0.05}>
            <MediaTile entry={entry} onOpen={() => onOpen(i)} />
          </li>
        ))}
      </ul>

      {entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Aucun média dans cette catégorie.
        </p>
      )}
    </>
  );
}

function MediaTile({ entry, onOpen }: { entry: MediaEntry; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  // La vignette est réclamée bien avant d'entrer dans le champ, pour être déjà
  // là quand on arrive dessus (cf. `useNearViewport`).
  const { ref, near } = useNearViewport<HTMLButtonElement>();

  return (
    <button
      ref={ref}
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
          // `lazy` → `eager` dès que la vignette approche : le navigateur
          // reprend alors le chargement qu'il avait différé. On garde donc le
          // bénéfice du paresseux — rien n'est demandé pour une vignette qu'on
          // n'atteindra jamais — mais c'est nous qui fixons la distance, et non
          // l'heuristique du navigateur, parfois si courte que la vignette se
          // peint sous les yeux du visiteur.
          loading={near ? "eager" : "lazy"}
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

