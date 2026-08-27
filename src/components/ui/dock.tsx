"use client";

import { useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DockItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** Réglage actif : le point sous l'icône, comme une application ouverte. */
  active?: boolean;
}

/** Géométrie du dock, en pixels. */
const SIZE = 40;
const GAP = 4;
/** Hauteur de la fenêtre d'influence autour du pointeur. */
const EFFECT = 130;
const MIN_SCALE = 1;
const MAX_SCALE = 1.55;

/**
 * Barre d'outils façon dock macOS, d'après `dhmnpunit/mac-os-dock` (21st.dev).
 *
 * La magnification reprend l'algorithme de l'original : la distance entre le
 * pointeur et le centre de chaque icône est ramenée sur un tour de cercle, et
 * `(1 - cos θ) / 2` en tire un facteur d'échelle. C'est ce qui donne la vague —
 * une interpolation linéaire produirait un triangle, nettement plus sec.
 *
 * Vertical et non horizontal : cette barre longe le bord gauche de la carte, et
 * macOS admet lui-même un dock sur le côté. Les icônes grossissent donc vers la
 * droite (`transform-origin` à gauche), sur la carte, plutôt que de pousser la
 * colonne hors de l'écran.
 *
 * Les voisines s'écartent au lieu de se chevaucher : chaque icône est décalée du
 * cumul de ce que les précédentes ont gagné en hauteur. Sans ce décalage, une
 * icône agrandie mordrait sur ses voisines.
 *
 * Aucune dépendance dans l'original, aucune ici non plus.
 */
export function Dock({ items, className }: { items: DockItem[]; className?: string }) {
  const [pointer, setPointer] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const scales = items.map((_, i) => {
    if (pointer === null) return MIN_SCALE;
    const centre = i * (SIZE + GAP) + SIZE / 2;
    const min = pointer - EFFECT / 2;
    if (centre < min || centre > pointer + EFFECT / 2) return MIN_SCALE;
    const theta = ((centre - min) / EFFECT) * 2 * Math.PI;
    return MIN_SCALE + ((1 - Math.cos(theta)) / 2) * (MAX_SCALE - MIN_SCALE);
  });

  // Décalage cumulé : ce que les icônes précédentes ont pris en hauteur, plus la
  // moitié de ce que celle-ci prend — elle grandit des deux côtés de son centre.
  // Somme refaite à chaque rang plutôt qu'accumulée dans une variable : neuf
  // icônes, le coût est nul, et rien n'est muté pendant le rendu.
  const offsets = scales.map(
    (s, i) => scales.slice(0, i).reduce((sum, prev) => sum + (prev - 1) * SIZE, 0) + ((s - 1) * SIZE) / 2,
  );

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current?.getBoundingClientRect();
        if (r) setPointer(e.clientY - r.top);
      }}
      onPointerLeave={() => setPointer(null)}
      className={cn("rs-glass flex flex-col rounded-[22px] p-1.5", className)}
      style={{ gap: GAP }}
    >
      {items.map((item, i) => (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              aria-pressed={item.active}
              className={cn(
                "relative grid shrink-0 place-items-center rounded-2xl text-foreground transition-colors cursor-pointer hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2",
                item.active && "text-accent-2",
              )}
              style={{
                width: SIZE,
                height: SIZE,
                // Pas de transition sur la transformée : elle est déjà pilotée
                // image par image par le pointeur, une durée par-dessus la
                // rendrait molle et en retard sur la souris.
                transform: `translateY(${offsets[i]}px) scale(${scales[i]})`,
                transformOrigin: "left center",
              }}
            >
              {item.icon}
              {/* Le point de l'application ouverte, repris de macOS. */}
              {item.active && (
                <span aria-hidden className="absolute -left-0.5 h-1 w-1 rounded-full bg-accent-2" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
