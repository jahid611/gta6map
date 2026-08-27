"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Compass, ExternalLink, MapPin } from "@/components/ui/icons";
import { BASEMAPS, type BasemapId } from "@/lib/map/basemaps";
import { markerHtml, MARKER_SIZE } from "@/lib/map/icons";
import { cn } from "@/lib/utils";

interface RealWorldMapProps {
  lat: number;
  lng: number;
  /** Libellé du lieu réel, pour le titre accessible de la carte. */
  label: string;
  /** Couleur du lieu, pour que le repère soit celui de la carte du jeu. */
  color?: string;
  /** Glyphe de la catégorie, idem. */
  icon?: string;
}

/**
 * Vue aérienne du lieu réel, en carte qui se déplie.
 *
 * Composition et gestes repris de `jatin-yadav05/expand-map` (21st.dev) : une
 * vignette compacte qui s'incline en suivant la souris et s'ouvre au clic. Deux
 * écarts avec l'original :
 *
 *  - il dessinait une fausse carte en SVG (rues, pâtés d'immeubles, repère
 *    animé). Nous en avons une vraie ;
 *  - `framer-motion` est remplacé par deux variables CSS pilotées au
 *    `mousemove`. Une dépendance d'animation entière pour deux rotations ne se
 *    justifiait pas.
 *
 * Leaflet et non un cadre Google Maps, pour la raison déjà consignée dans
 * `RealWorldView` : un `<iframe>` impose « Ctrl + molette » pour zoomer, et rien
 * ne permet de le désactiver depuis la page — le cadre est d'une autre origine.
 * Ici la molette zoome directement. Les tuiles sont celles de la vue réelle
 * plein écran, satellite d'abord : on vient comparer le terrain, et un plan
 * dessiné ne montre justement pas le terrain.
 *
 * Pourquoi une vue par lieu et non une superposition sur toute la carte : la
 * géographie de Leonida est un collage. Port Gellhorn correspond à Panama City,
 * à 563 km de Miami dans la réalité, quand le jeu les place à une dizaine de
 * kilomètres. Un ajustement affine sur les 1 043 correspondances confirmées
 * laisse 24 km d'erreur médiane. Chaque correspondance prise isolément, elle,
 * est exacte : c'est à cette échelle que la vue réelle a du sens.
 */
export function RealWorldMap({ lat, lng, label, color = "#8cdbf3", icon = "MapPin" }: RealWorldMapProps) {
  const [open, setOpen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const cardRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);

  // Inclinaison : deux variables CSS plutôt qu'un état React — le pointeur émet
  // des dizaines d'événements par seconde, un rendu React à chacun serait du
  // gâchis pour une transformation que le compositeur sait faire seul.
  //
  // Suspendue une fois la carte ouverte : incliner le plan sous le curseur
  // pendant qu'on essaie de le déplacer rendrait la manipulation pénible.
  const tilt = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el || open || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 9}deg`);
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`);
  };
  const untilt = () => {
    cardRef.current?.style.setProperty("--rx", "0deg");
    cardRef.current?.style.setProperty("--ry", "0deg");
  };

  // La carte n'est montée qu'une fois dépliée : Leaflet crée des couches, des
  // écouteurs et une requête de tuiles, inutiles tant que la vignette est fermée.
  useEffect(() => {
    const node = nodeRef.current;
    if (!open || !node) return;

    const map = L.map(node, {
      center: [lat, lng],
      zoom: 17,
      // La molette zoome directement, sans touche de modification.
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    // Notre marqueur, pas celui de Leaflet : son icône par défaut est un PNG
    // chargé par un chemin relatif à sa feuille de style, que le bundler ne
    // sert pas — on obtenait le carré d image manquante.
    L.marker([lat, lng], {
      icon: L.divIcon({
        html: markerHtml({ color, icon }),
        className: "gta-marker-wrapper",
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      }),
    }).addTo(map);

    // Leaflet mesure son conteneur à la création. Ici il est encore en train de
    // se déplier, d'où une mesure trop courte et des tuiles manquantes en bas :
    // on remesure une fois la transition de hauteur terminée.
    const settle = window.setTimeout(() => map.invalidateSize(), 550);

    return () => {
      window.clearTimeout(settle);
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
    };
  }, [open, lat, lng, color, icon]);

  // Fond de carte : remplacé sur la carte existante, jamais en la reconstruisant
  // — on garde ainsi la position et le zoom en cours.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const set = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];
    baseRef.current?.remove();
    baseRef.current = L.tileLayer(set.url, { maxZoom: set.maxZoom, attribution: set.attribution }).addTo(map);
  }, [basemap, open]);

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
        style={{ transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))" }}
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

        <div
          ref={nodeRef}
          aria-label={`${label} — vue aérienne`}
          className={cn("h-full w-full", !open && "hidden")}
        />

        {open && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pb-8 pt-2.5">
            {/* Texte simple, pas de pastilles : deux mots à choisir, le
                soulignement de l'actif suffit à dire lequel. */}
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBasemap(b.id)}
                aria-pressed={basemap === b.id}
                className={cn(
                  "pointer-events-auto text-xs cursor-pointer",
                  basemap === b.id ? "font-bold text-white underline underline-offset-4" : "text-white/60 hover:text-white",
                )}
              >
                {b.label}
              </button>
            ))}

            <a
              href={`https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=18&basemap=satellite`}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent-2 hover:underline"
            >
              Google Maps <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="pointer-events-auto text-xs text-white/60 hover:text-white cursor-pointer"
            >
              Replier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
