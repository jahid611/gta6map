"use client";

import { useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer } from "react-leaflet";
import type { Category, Location, MapSection } from "@/types";
import { GtaCRS } from "@/lib/map/crs";
import { COVERED_BOUNDS, DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM } from "@/lib/map/config";
import { useMapStore } from "@/store/useMapStore";
import { useProgressStore } from "@/store/useProgressStore";
import { useUIStore } from "@/store/useUIStore";
import { GtaTileLayer } from "./GtaTileLayer";
import { MarkerClusterLayer } from "./MarkerClusterLayer";
import { CustomMarkersLayer } from "./CustomMarkersLayer";
import { AreaLabelsLayer } from "./AreaLabelsLayer";
import { CoordinateGridLayer } from "./CoordinateGridLayer";
import { MeasureLayer } from "./MeasureLayer";
import { MapController } from "./MapController";
import { MapControls } from "./MapControls";

export interface InteractiveMapProps {
  /** Lieux déjà filtrés (catégories visibles, trouvés masqués…). */
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
  sections: readonly MapSection[];
  districts: readonly { name: string; x: number; y: number }[];
  className?: string;
}

/**
 * Carte Leaflet complète (client only — chargée via `MapLoader` avec `ssr: false`).
 *  - CRS custom `GtaCRS` : coordonnées en mètres RAGE, `latLng = [y, x]`
 *  - tuiles gtadb 256 px (0..6), upscale jusqu'au zoom 8
 *  - `maxBounds` = zone couverte (+ marge), rebond visqueux
 *  - clustering, caméras de trailers, étiquettes de zones, marqueurs custom
 */
export default function InteractiveMap({ locations, categoriesBySlug, sections, districts, className }: InteractiveMapProps) {
  // Vue initiale lue une seule fois : éviter de re-rendre la carte à chaque `moveend`.
  const [initial] = useState(() => {
    const s = useMapStore.getState();
    return { center: s.center, zoom: s.zoom };
  });
  const initialCenter = initial.center;
  const initialZoom = initial.zoom;
  const tileSet = useMapStore((s) => s.tileSet);
  const showAreaLabels = useMapStore((s) => s.showAreaLabels);
  const showGrid = useMapStore((s) => s.showGrid);
  const mapFilter = useMapStore((s) => s.mapFilter);
  const measuring = useMapStore((s) => s.measuring);
  const entries = useProgressStore((s) => s.entries);
  const selectedSlug = useUIStore((s) => s.selectedSlug);

  // Marge de navigation autour de la zone couverte, sur les quatre côtés. Hors
  // couverture, `GtaTileLayer` sert une tuile vide et le bleu océan de
  // `.leaflet-container` transparaît : la marge ne coûte aucune requête. Elle
  // est large (8 km) pour qu'on puisse amener un lieu côtier au centre de
  // l'écran sans que le rebond de `maxBounds` le repousse.
  //
  // La bande ouest de la couverture porte le cartouche du fond communautaire
  // (légende, crédits, planche de frames). Il fait partie de la carte et reste
  // donc visible : on borne bien sur `COVERED_BOUNDS`.
  const maxBounds = useMemo(() => {
    const [[xMin, yMin], [xMax, yMax]] = COVERED_BOUNDS;
    const pad = 8_000;
    return L.latLngBounds([yMin - pad, xMin - pad], [yMax + pad, xMax + pad]);
  }, []);

  return (
    <MapContainer
      crs={GtaCRS}
      center={[initialCenter[1] ?? DEFAULT_VIEW.center[1], initialCenter[0] ?? DEFAULT_VIEW.center[0]]}
      zoom={initialZoom ?? DEFAULT_VIEW.zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={maxBounds}
      maxBoundsViscosity={0.85}
      zoomControl={false}
      attributionControl
      zoomSnap={0.5}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={120}
      wheelDebounceTime={40}
      // Au-delà de 4 niveaux d'écart, le zoom est appliqué d'un coup plutôt
      // qu'animé : animer un saut de 8 niveaux revient à interpoler toute la
      // couche de tuiles et les 1 500 marqueurs pour une transition que
      // personne ne suit du regard.
      zoomAnimationThreshold={4}
      // Fondu réactivé. Sans lui, chaque niveau de tuiles apparaît et disparaît
      // d'un coup au zoom — c'est ce clignotement, pas la fluidité du geste, que
      // l'on voit en premier. Le fondu est une transition d'opacité composée par
      // le GPU : son coût est marginal comparé au rechargement des tuiles.
      fadeAnimation
      // Marqueurs non animés pendant le zoom : Leaflet devrait sinon
      // repositionner chaque icône image par image.
      markerZoomAnimation={false}
      className={className ?? "h-full w-full"}
    >
      <GtaTileLayer tileSet={tileSet} filter={mapFilter} />
      <CoordinateGridLayer visible={showGrid} />
      <AreaLabelsLayer sections={sections} districts={districts} visible={showAreaLabels} />
      <MarkerClusterLayer
        locations={locations}
        categoriesBySlug={categoriesBySlug}
        entries={entries}
        selectedSlug={selectedSlug}
      />
      <CustomMarkersLayer />
      <MeasureLayer active={measuring} />
      <MapController />
      <MapControls />
    </MapContainer>
  );
}
