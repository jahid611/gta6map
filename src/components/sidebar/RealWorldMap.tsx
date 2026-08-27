"use client";

import { useRef, useState } from "react";
import { Compass, ExternalLink, MapPin } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface RealWorldMapProps {
  lat: number;
  lng: number;
  /** Libellé du lieu réel, pour le titre accessible du cadre. */
  label: string;
}

/**
 * Vue aérienne, sans clé d'API. `t=k` sélectionne l'imagerie satellite du cadre
 * hérité de Google Maps — le terrain photographié, et non le plan dessiné.
 */
const satSrc = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}&z=18&t=k&output=embed`;

/** Repli en plan : les rues nommées, quand il s'agit de se repérer. */
const planSrc = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

/**
 * Vue du monde réel pour un lieu du jeu, en carte qui se déplie.
 *
 * Composition et gestes repris de `jatin-yadav05/expand-map` (21st.dev) : une
 * vignette compacte qui s'incline en suivant la souris et s'ouvre au clic. Deux
 * écarts avec l'original :
 *
 *  - il dessinait une fausse carte en SVG (rues, pâtés d'immeubles, repère
 *    animé). Nous en avons une vraie : c'est l'imagerie aérienne qui prend la
 *    place ;
 *  - `framer-motion` est remplacé par deux variables CSS pilotées au
 *    `mousemove`. Une dépendance d'animation entière pour deux rotations ne se
 *    justifiait pas.
 *
 * Le satellite passe avant le plan : on vient comparer le terrain réel à celui
 * du jeu, et un plan dessiné ne montre justement pas le terrain. La bascule vers
 * le plan reste là pour les rues nommées, quand il s'agit de se repérer.
 *
 * Pourquoi une vue par lieu et non une superposition sur toute la carte : la
 * géographie de Leonida est un collage. Port Gellhorn correspond à Panama City,
 * à 563 km de Miami dans la réalité, quand le jeu les place à une dizaine de
 * kilomètres. Un ajustement affine sur les 1 043 correspondances confirmées
 * laisse 24 km d'erreur médiane. Chaque correspondance prise isolément, elle,
 * est exacte : c'est à cette échelle que la vue réelle a du sens.
 */
export function RealWorldMap({ lat, lng, label }: RealWorldMapProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sat" | "plan">("sat");
  const cardRef = useRef<HTMLDivElement>(null);

  // Inclinaison : deux variables CSS plutôt qu'un état React — le pointeur émet
  // des dizaines d'événements par seconde, un rendu React à chacun serait du
  // gâchis pour une transformation que le compositeur sait faire seul.
  const tilt = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${-y * 9}deg`);
    el.style.setProperty("--ry", `${x * 9}deg`);
  };
  const untilt = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div style={{ perspective: "1000px" }}>
      <div
        ref={cardRef}
        onPointerMove={tilt}
        onPointerLeave={untilt}
        className={cn(
          "rs-card relative overflow-hidden rounded-2xl transition-[height,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "h-64" : "h-24",
        )}
        style={{ transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))", transformStyle: "preserve-3d" }}
      >
        {/* Repliée, la carte entière est le bouton d'ouverture. */}
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-0 flex items-center gap-3 px-4 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2"
            aria-expanded={false}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent-2/40 text-accent-2">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
              <span className="vi-num block text-[10px] text-muted-2">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-2">
              <Compass className="h-3.5 w-3.5" /> Aperçu
            </span>
          </button>
        )}

        {open && (
          <>
            {/* `key` sur le mode : changer l'adresse d'un cadre déjà chargé laisse
                parfois l'ancienne vue en place, le remonter garantit le passage. */}
            <iframe
              key={mode}
              src={mode === "sat" ? satSrc(lat, lng) : planSrc(lat, lng)}
              title={`${label} — ${mode === "sat" ? "vue satellite" : "plan"}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full animate-fade-in border-0"
            />

            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
              {/* Texte simple, pas de pastilles : deux mots à choisir, le
                  soulignement de l'actif suffit à dire lequel. */}
              <button
                type="button"
                onClick={() => setMode("sat")}
                aria-pressed={mode === "sat"}
                className={cn("text-xs cursor-pointer", mode === "sat" ? "font-bold text-white underline underline-offset-4" : "text-white/60 hover:text-white")}
              >
                Satellite
              </button>
              <span aria-hidden className="h-3 w-px bg-white/25" />
              <button
                type="button"
                onClick={() => setMode("plan")}
                aria-pressed={mode === "plan"}
                className={cn("text-xs cursor-pointer", mode === "plan" ? "font-bold text-white underline underline-offset-4" : "text-white/60 hover:text-white")}
              >
                Plan
              </button>

              <a
                href={`https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=18&basemap=satellite`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent-2 hover:underline"
              >
                Ouvrir <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Replier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
