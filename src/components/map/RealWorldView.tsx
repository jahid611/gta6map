"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { Category, Location } from "@/types";
import { clusterHtml, markerHtml, MARKER_SIZE } from "@/lib/map/icons";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { Compass, MapPin, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface RealWorldViewProps {
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
}

/** Nombre de lieux voisins retenus pour transposer une vue d'une carte à l'autre. */
const SAMPLE = 12;

/**
 * Bornes plausibles de la Floride. Onze fiches portent des coordonnées
 * manifestement erronées (Californie) qui, sans ce filtre, déplaceraient la vue
 * à l'autre bout du pays.
 */
const FLORIDA = { latMin: 24, latMax: 31, lngMin: -88, lngMax: -79 };

function isPlausible(l: Location): boolean {
  const rw = l.realWorld;
  return (
    rw?.lat != null &&
    rw?.lng != null &&
    rw.lat > FLORIDA.latMin &&
    rw.lat < FLORIDA.latMax &&
    rw.lng > FLORIDA.lngMin &&
    rw.lng < FLORIDA.lngMax
  );
}

/**
 * Fonds de la vue réelle.
 *
 * « Satellite » par défaut : on vient chercher à quoi ressemble vraiment
 * l'endroit, pas son plan de rues. Le fond « Plan » reste utile pour lire les
 * noms de voies et se repérer.
 *
 * Esri World Imagery et OpenStreetMap sont tous deux libres d'usage sous
 * réserve d'attribution — celle-ci est portée par la carte.
 */
const BASEMAPS = [
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "plan",
    label: "Plan",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
] as const;

/** Médiane — plus robuste qu'une moyenne face à une fiche mal renseignée. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Vue du monde réel : une seconde carte Leaflet, en Web Mercator et en tuiles
 * OpenStreetMap, portant les mêmes lieux à leurs coordonnées réelles confirmées.
 *
 * Pourquoi une vraie carte et non un cadre Google Maps : un `<iframe>` ne laisse
 * ni dessiner nos marqueurs, ni lire sa position, ni reprendre la molette — il
 * impose « Ctrl + molette » pour zoomer. Les trois choses manquaient à la fois.
 *
 * Pourquoi ce n'est pas une superposition calée au pixel : la géographie de
 * Leonida est un collage. Port Gellhorn correspond à Panama City, à 563 km de
 * Miami dans la réalité, alors que le jeu les place à une dizaine de kilomètres
 * l'un de l'autre. Un ajustement affine sur les 1 043 correspondances confirmées
 * donne 24 km d'erreur médiane. Chaque correspondance prise isolément, en
 * revanche, est exacte : c'est sur elle que tout repose ici.
 *
 * La bascule conserve donc l'endroit, pas les coordonnées : on prend les lieux
 * les plus proches du centre de l'écran et on rouvre l'autre carte sur la
 * médiane de leurs positions. Le trajet fonctionne dans les deux sens.
 */
export function RealWorldView({ locations, categoriesBySlug }: RealWorldViewProps) {
  const active = useMapStore((s) => s.realWorld);
  const toggle = useMapStore((s) => s.toggleRealWorld);
  const target = useMapStore((s) => s.realWorldTarget);
  const clearTarget = useMapStore((s) => s.clearRealWorldTarget);
  // Le centre du jeu et la vue mémorisée sont lus dans `computeEntry`, au moment
  // de l'ouverture — les abonner ici reconstruirait la carte à chaque
  // déplacement de l'une ou l'autre.
  const flyTo = useMapStore((s) => s.flyTo);
  const setRealWorldView = useMapStore((s) => s.setRealWorldView);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const selectedSlug = useUIStore((s) => s.selectedSlug);
  const setHovered = useUIStore((s) => s.setHovered);
  const setHoverPreview = useUIStore((s) => s.setHoverPreview);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** slug → marqueur, pour rejouer l'icône du lieu sélectionné. */
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const [basemap, setBasemap] = useState<string>(BASEMAPS[0].id);

  const plausible = useMemo(() => locations.filter(isPlausible), [locations]);

  /**
   * Où ouvrir la vue réelle.
   *
   * Coordonnées exactes si la fiche en porte ; sinon transposition depuis une
   * position de jeu — celle d'un lieu sans correspondance relevée, ou le centre
   * de l'écran. La transposition est approchée par construction : elle situe le
   * quartier, pas le bâtiment.
   */
  const computeEntry = useCallback(() => {
    // Lu au moment de l'appel, pas capturé : le cadrage d'ouverture ne doit être
    // calculé qu'une fois, à la création de la carte.
    const { realWorldTarget: t, realWorldView: saved, center } = useMapStore.getState();

    if (t?.kind === "real") {
      return { lat: t.lat, lng: t.lng, zoom: t.zoom ?? 16, exact: true };
    }
    // Sans cible explicite, on restitue d'abord la vue quittée : c'est ce qui
    // rend l'aller-retour sans perte. La transposition ne sert qu'à la toute
    // première ouverture.
    if (!t && saved) return { ...saved, exact: true };

    const [cx, cy] = t?.kind === "game" ? [t.x, t.y] : center;
    const near = plausible
      .map((l) => ({ l, d: (l.x - cx) ** 2 + (l.y - cy) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, SAMPLE);
    if (near.length === 0) return null;

    return {
      lat: median(near.map((n) => n.l.realWorld.lat as number)),
      lng: median(near.map((n) => n.l.realWorld.lng as number)),
      // Un point transposé mérite un cadrage plus large qu'une adresse exacte :
      // afficher un toit précis suggérerait une précision qu'on n'a pas.
      zoom: t?.kind === "game" ? 15 : 13,
      exact: false,
    };
  }, [plausible]);

  /** Y a-t-il de quoi situer la vue ? Sert au repli affiché sous la carte. */
  const canLocate = plausible.length > 0;

  useEffect(() => {
    const node = nodeRef.current;
    const entry = active ? computeEntry() : null;
    if (!active || !node || !entry) return;

    const map = L.map(node, {
      center: [entry.lat, entry.lng],
      zoom: entry.zoom,
      // La molette zoome directement : c'est une carte à part entière, pas un
      // cadre incrusté dans une page qu'on ferait défiler.
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;

    // La couche de base est créée ici puis remplacée par l'effet dédié : la
    // carte n'est pas reconstruite quand on change de fond, on garde donc la
    // position et le zoom en cours.
    baseRef.current = L.tileLayer(BASEMAPS[0].url, {
      maxZoom: BASEMAPS[0].maxZoom,
      attribution: BASEMAPS[0].attribution,
    }).addTo(map);

    L.control.zoom({ position: "topleft" }).addTo(map);

    // Chaque déplacement est mémorisé : c'est cette trace qui sera restituée au
    // retour, au pixel et au niveau de zoom près.
    const remember = () => {
      const c = map.getCenter();
      setRealWorldView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on("moveend", remember);
    map.on("zoomend", remember);
    remember();

    // Mêmes blips que sur la carte du jeu : couleur de catégorie, glyphe
    // correspondant, taille identique. Regroupés, car 1 029 points sur une ville
    // se chevauchent autant ici que là-bas.
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      animate: false,
      // Indispensable : sans `iconCreateFunction`, la bibliothèque pose ses
      // propres icônes `.marker-cluster`, que `globals.css` rend transparentes
      // pour laisser place aux nôtres — on n'obtenait donc que des chiffres nus
      // flottant sur la carte. On réutilise le même rendu que la carte du jeu.
      iconCreateFunction: (cluster) => {
        const children = cluster.getAllChildMarkers();
        const tally = new Map<string, number>();
        for (const child of children) {
          const color = (child.options as { gtaColor?: string }).gtaColor ?? "#94a3b8";
          tally.set(color, (tally.get(color) ?? 0) + 1);
        }
        let dominant = "#94a3b8";
        let best = 0;
        for (const [color, n] of tally) {
          if (n > best) {
            best = n;
            dominant = color;
          }
        }
        const count = cluster.getChildCount();
        const size = count < 10 ? 30 : count < 50 ? 36 : 44;
        return L.divIcon({
          html: clusterHtml(count, dominant),
          className: "gta-cluster-wrapper",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    for (const l of plausible) {
      const category = categoriesBySlug.get(l.categorySlug);
      const color = category?.color ?? l.color;
      const marker = L.marker([l.realWorld.lat as number, l.realWorld.lng as number], {
        // Lue par `iconCreateFunction` pour teinter l'agrégat à la couleur
        // dominante des points qu'il regroupe. Même contournement de typage que
        // sur la carte du jeu : Leaflet ne déclare pas d'options libres.
        ...({ gtaColor: color } as object),
        icon: L.divIcon({
          html: markerHtml({ color, icon: category?.icon ?? "MapPin" }),
          className: "gta-marker-wrapper",
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        }),
      });
      // Même comportement de survol que sur la carte du jeu : mise en évidence
      // immédiate, puis aperçu après un temps d'arrêt (cf. `MarkerPreview`).
      marker.on("click", () => selectLocation(l.slug, { keepPanel: true }));
      marker.on("mouseover", (e: L.LeafletMouseEvent) => {
        setHovered(l.slug);
        const { clientX, clientY } = e.originalEvent;
        if (previewTimer.current) clearTimeout(previewTimer.current);
        previewTimer.current = setTimeout(() => setHoverPreview({ slug: l.slug, x: clientX, y: clientY }), 420);
      });
      marker.on("mouseout", () => {
        setHovered(null);
        if (previewTimer.current) clearTimeout(previewTimer.current);
        setHoverPreview(null);
      });
      markersRef.current.set(l.slug, marker);
      group.addLayer(marker);
    }
    group.addTo(map);

    // Copie locale : la ref peut pointer ailleurs au moment où le nettoyage
    // s'exécute, on vide donc bien la table de cette instance de carte.
    const registry = markersRef.current;
    return () => {
      registry.clear();
      map.off("moveend", remember);
      map.off("zoomend", remember);
      map.remove();
      mapRef.current = null;
    };
  }, [active, computeEntry, plausible, categoriesBySlug, selectLocation, setRealWorldView, setHovered, setHoverPreview]);

  /**
   * Nouvelle cible sur une carte déjà ouverte : on s'y déplace au lieu de tout
   * reconstruire, et sans jamais reculer le zoom. Demander 17 alors que
   * l'utilisateur est à 19 doit rapprocher la vue du point, pas l'éloigner.
   *
   * Les deux formes de cible sont traitées. Ne gérer que `real` laissait sans
   * effet tout ce qui n'a pas de correspondance relevée — les caméras de
   * trailers, notamment, qui sont des positions de prise de vue et non des
   * adresses : un clic depuis la médiathèque ne déplaçait alors rien.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!active || !map || !target) return;

    if (target.kind === "real") {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), target.zoom ?? 17), { duration: 0.8 });
      return;
    }

    // Cible exprimée en coordonnées de jeu : on la transpose par ses voisins
    // confirmés, comme à l'ouverture.
    const near = plausible
      .map((l) => ({ l, d: (l.x - target.x) ** 2 + (l.y - target.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, SAMPLE);
    if (near.length === 0) return;

    map.flyTo(
      [
        median(near.map((n) => n.l.realWorld.lat as number)),
        median(near.map((n) => n.l.realWorld.lng as number)),
      ],
      // Position approchée : on ne resserre pas au-delà de l'échelle du quartier.
      Math.min(map.getZoom(), 15),
      { duration: 0.8 },
    );
  }, [active, target, plausible]);

  // Changement de fond : on échange la seule couche de tuiles, sans toucher au
  // reste de la carte ni aux marqueurs.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const def = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];
    baseRef.current?.remove();
    baseRef.current = L.tileLayer(def.url, { maxZoom: def.maxZoom, attribution: def.attribution }).addTo(map);
    // La couche de base doit rester sous les marqueurs.
    baseRef.current.bringToBack();
  }, [basemap, active]);

  /**
   * Retour à la carte du jeu, au même endroit : on lit le centre de la carte
   * réelle et on cherche les lieux les plus proches en coordonnées réelles.
   */
  /** Lieu sélectionné, s'il est visible dans le monde réel. */
  const selected = selectedSlug ? locations.find((l) => l.slug === selectedSlug) : null;

  // Rejoue l'icône du lieu sélectionné en état « sélectionné » : recréer le
  // nœud relance l'animation CSS, ce qui fait clignoter le point qu'on vient
  // d'atteindre. Même signal que sur la carte du jeu.
  useEffect(() => {
    if (!active || !selected) return;
    const marker = markersRef.current.get(selected.slug);
    if (!marker) return;
    const category = categoriesBySlug.get(selected.categorySlug);
    marker.setIcon(
      L.divIcon({
        html: markerHtml({
          color: category?.color ?? selected.color,
          icon: category?.icon ?? "MapPin",
          selected: true,
        }),
        className: "gta-marker-wrapper",
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      }),
    );
  }, [active, selected, categoriesBySlug]);

  /**
   * Retour à la carte du jeu.
   *
   * Deux précisions différentes, et c'est assumé : si un lieu est sélectionné,
   * on connaît sa position de jeu exacte et on y va directement. Sinon on
   * transpose depuis le centre de l'écran, ce qui situe le quartier.
   *
   * Dans les deux cas la vue réelle vient d'être mémorisée par `remember()`,
   * donc y revenir la restituera telle quelle.
   */
  const back = (exactTo?: Location) => {
    if (exactTo) {
      flyTo([exactTo.x, exactTo.y], 7);
    } else {
      const map = mapRef.current;
      if (map) {
        const c = map.getCenter();
        const near = plausible
          .map((l) => ({
            l,
            d: ((l.realWorld.lat as number) - c.lat) ** 2 + ((l.realWorld.lng as number) - c.lng) ** 2,
          }))
          .sort((a, b) => a.d - b.d)
          .slice(0, SAMPLE);

        if (near.length > 0) {
          flyTo([median(near.map((n) => n.l.x)), median(near.map((n) => n.l.y))], 5);
        }
      }
    }
    clearTarget();
    toggle();
  };

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-[500]">
      <div ref={nodeRef} className="h-full w-full" />

      {!canLocate && (
        <div className="absolute inset-0 grid place-items-center bg-background px-6 text-center text-sm text-muted">
          Aucun lieu à correspondance réelle confirmée dans cette zone.
        </div>
      )}

      <div className="rs-glass absolute left-1/2 top-4 z-[600] flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm">
        <Compass className="h-4 w-4 shrink-0 text-accent-2" />
        <span className="whitespace-nowrap">
          {target?.kind === "game" ? (
            <>Monde réel — <span className="text-muted">position approchée</span></>
          ) : (
            <>
              Monde réel — <span className="vi-num font-semibold text-foreground">{plausible.length}</span> lieux
            </>
          )}
        </span>

        <span className="flex items-center gap-1">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBasemap(b.id)}
              aria-pressed={basemap === b.id}
              className={cn(
                "rs-pill px-3 py-1 text-xs",
                basemap === b.id && "rs-pill--accent font-semibold",
              )}
            >
              {b.label}
            </button>
          ))}
        </span>
        {selected && (
          <button
            onClick={() => back(selected)}
            className="rs-pill rs-pill--accent inline-flex shrink-0 items-center gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <MapPin className="h-3.5 w-3.5" />
            Voir dans GTA VI
          </button>
        )}

        <button
          onClick={() => back()}
          className="rs-pill grid h-8 w-8 shrink-0 place-items-center"
          aria-label="Revenir à la carte du jeu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
