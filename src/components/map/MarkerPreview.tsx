"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { Category, Location } from "@/types";
import { frameUrl, photoUrl } from "@/lib/media";
import { pastel } from "@/lib/colors";
import { useUIStore } from "@/store/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Camera, MapPin } from "@/components/ui/icons";

interface MarkerPreviewProps {
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
}

/** Marge entre le curseur et la carte, et garde au bord de la fenêtre. */
const OFFSET = 18;
const EDGE = 12;
const CARD_W = 300;
const CARD_H = 250;

/**
 * Aperçu affiché après un survol prolongé d'un marqueur.
 *
 * Positionné en coordonnées viewport (`position: fixed`) plutôt qu'ancré à la
 * carte Leaflet : l'aperçu doit rester stable même si la carte se déplace sous
 * le curseur, et il n'a pas à être reprojeté à chaque `move`.
 *
 * Il bascule de côté quand il déborderait de la fenêtre — sans quoi les points
 * proches du bord droit ou bas afficheraient une carte tronquée.
 *
 * `pointer-events: none` : l'aperçu ne doit jamais intercepter le clic destiné
 * au marqueur qu'il recouvre, sinon on ne pourrait plus ouvrir la fiche.
 */
export function MarkerPreview({ locations, categoriesBySlug }: MarkerPreviewProps) {
  const preview = useUIStore((s) => s.hoverPreview);
  // Seconde barrière, côté rendu : sur tactile la fiche suffit, l'aperçu ferait doublon.
  const hoverable = useMediaQuery("(hover: hover) and (pointer: fine)", true);
  const bySlug = useMemo(() => new Map(locations.map((l) => [l.slug, l])), [locations]);
  const location = preview ? bySlug.get(preview.slug) : null;

  if (!preview || !location || !hoverable) return null;

  const category = categoriesBySlug.get(location.categorySlug);
  const accent = pastel(category?.color ?? location.color);
  const image = location.media ? frameUrl(location.media.thumb) : photoUrl(location.photos?.ig);

  // Bord droit utile : la fiche ouverte occupe la droite de l'écran. L'aperçu
  // s'arrête donc à son bord gauche plutôt qu'à celui de la fenêtre — il repasse
  // à gauche du curseur au lieu de se poser sur le texte qu'on est en train de
  // lire. Le supprimer dès qu'une fiche est ouverte, comme on le faisait, privait
  // de l'aperçu tout le temps où l'on compare deux lieux.
  const panel = document.querySelector<HTMLElement>("[data-location-panel]");
  const rightLimit = panel ? panel.getBoundingClientRect().left : window.innerWidth;

  const flipX = preview.x + OFFSET + CARD_W > rightLimit - EDGE;
  const flipY = preview.y + OFFSET + CARD_H > window.innerHeight - EDGE;

  return (
    <div
      role="tooltip"
      aria-hidden
      className="rs-menu pointer-events-none fixed z-[1200] w-[300px] overflow-hidden rounded-2xl"
      style={{
        left: flipX ? preview.x - OFFSET - CARD_W : preview.x + OFFSET,
        top: flipY ? Math.max(EDGE, preview.y - OFFSET - CARD_H) : preview.y + OFFSET,
        animation: "vi-preview-in 160ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {image ? (
        <div className="relative aspect-video w-full bg-surface-3">
          <Image src={image} alt="" fill sizes="300px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="grid aspect-[5/2] w-full place-items-center bg-surface-3 text-muted-2">
          <MapPin className="h-6 w-6 opacity-40" />
        </div>
      )}

      <div className="p-3">
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
          <span className="vi-kicker truncate text-[10px]" style={{ color: accent }}>
            {category?.name ?? "Lieu"}
          </span>
        </p>

        <p className="mt-1 truncate text-sm font-semibold text-foreground">{location.name}</p>

        {location.area && <p className="mt-0.5 truncate text-xs text-muted">{location.area}</p>}

        <p className="mt-2 flex items-center justify-between text-[11px] text-muted-2">
          <span className="vi-num">
            {Math.round(location.x)}, {Math.round(location.y)}
          </span>
          {location.media && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {location.media.sourceLabel}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
