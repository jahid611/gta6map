"use client";

import { useMemo, useState } from "react";
import { MEDIA_FILTERS, countByFilter, type MediaEntry } from "@/lib/media-catalog";
import { MediaCarousel } from "@/components/gallery/MediaCarousel";
import { MediaGrid } from "@/components/gallery/MediaGrid";
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

  // La scène est au format des visuels du jeu, 16:9, et les y montre entiers.
  // Les affiches de clips en sont écartées : elles sont carrées (1 440 × 1 440,
  // le recadrage social de Rockstar) et s'y feraient amputer de moitié — sans
  // compter qu'une image fixe de vidéo perd ce qui en fait l'intérêt.
  const stageWorthy = useMemo(() => entries.filter((e) => e.kind !== "clip"), [entries]);
  const featured = useMemo(() => {
    const picked = shown.filter((e) => e.kind !== "clip");
    // Filtre « Vidéos » : plus rien à mettre en scène. On garde la sélection
    // complète plutôt que de faire disparaître le carrousel — il porte le
    // filtre, et l'escamoter enfermerait le visiteur dans sa catégorie.
    return (picked.length ? picked : stageWorthy).slice(0, FEATURED);
  }, [shown, stageWorthy]);

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
        />
      </div>

      <section className="mx-auto max-w-6xl px-5 pb-14 pt-12">
        <MediaGrid entries={shown} />
      </section>
    </>
  );
}
