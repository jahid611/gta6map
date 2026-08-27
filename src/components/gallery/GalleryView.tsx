"use client";

import { useEffect, useMemo, useState } from "react";
import { MEDIA_FILTERS, countByFilter, type MediaEntry } from "@/lib/media-catalog";
import { MediaCarousel } from "@/components/gallery/MediaCarousel";
import { MediaGrid } from "@/components/gallery/MediaGrid";
import { MediaLightbox } from "@/components/gallery/MediaLightbox";
import { Select } from "@/components/ui/select";

/** Nombre de plans retenus pour la bande. Au-delà, elle défile. */
const FEATURED = 24;

/**
 * Corps de la galerie : le filtre, le carrousel et la grille.
 *
 * Le filtre est remonté ici parce qu'il commande désormais les deux : changer
 * de catégorie change la sélection du carrousel **et** celle de la grille. Il
 * vit dans la barre du carrousel, en tête de page — là où l'on décide ce qu'on
 * regarde — et non coincé entre le carrousel et la grille, où il ne semblait
 * gouverner que la seconde.
 */
export function GalleryView({ entries }: { entries: MediaEntry[] }) {
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => countByFilter(entries), [entries]);
  const active = MEDIA_FILTERS.find((f) => f.id === filter) ?? MEDIA_FILTERS[0];
  const shown = useMemo(() => entries.filter(active.match), [entries, active]);

  // La scène montre exactement ce que le filtre retient, clips compris : elle
  // les joue au lieu d'en afficher l'affiche (cf. `MediaCarousel`). Rien n'est
  // donc écarté — choisir « Vidéos » et voir autre chose serait un mensonge.
  const featured = useMemo(() => shown.slice(0, FEATURED), [shown]);

  // La visionneuse est ici, et non dans la grille : le carrousel l'ouvre aussi,
  // et deux exemplaires sur la même page se disputeraient les raccourcis
  // clavier, tous deux les ayant posés sur `window`. On mémorise un RANG dans
  // la sélection courante, pour pouvoir passer au média suivant sans repasser
  // par la grille.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // La sélection a changé sous nos pieds : le rang retenu ne désigne plus le
  // même média. Ajustement en phase de rendu, un effet laisserait paraître le
  // mauvais média le temps d'une image.
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setOpenIndex(null);
  }

  // Une vidéo ouverte en grand ne doit pas coexister avec les vignettes qui
  // décodent en arrière-plan : on les met toutes en pause à l'ouverture.
  useEffect(() => {
    if (openIndex === null) return;
    document.querySelectorAll<HTMLVideoElement>("video[data-gallery-video]").forEach((v) => v.pause());
  }, [openIndex]);

  return (
    <>
      {/* Le carrousel est hors de la colonne : il occupe toute la largeur de la
          fenêtre, la grille reste dans la colonne de lecture. L'un donne à
          voir, l'autre donne à chercher. */}
      <div className="mt-14">
        <MediaCarousel
          entries={featured}
          action={
            <Select
              label="Catégorie"
              value={filter}
              onChange={setFilter}
              align="end"
              options={MEDIA_FILTERS.map((f) => ({
                value: f.id,
                label: f.label,
                count: counts[f.id],
                disabled: counts[f.id] === 0,
              }))}
            />
          }
          // La bande n'est qu'un début de la sélection : on retrouve le rang
          // du plan dans la liste complète, celle que parcourt la visionneuse.
          onExpand={(entry) => setOpenIndex(shown.indexOf(entry))}
        />
      </div>

      <section className="mx-auto max-w-6xl px-5 pb-14 pt-12">
        <MediaGrid entries={shown} onOpen={setOpenIndex} />
      </section>

      {openIndex !== null && shown[openIndex] && (
        <MediaLightbox
          entries={shown}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
