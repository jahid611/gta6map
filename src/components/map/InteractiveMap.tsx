"use client";

import { useMemo } from "react";
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
  const initialCenter = useMapStore((s) => s.center);
  const initialZoom = useMapStore((s) => s.zoom);
  const tileSet = useMapStore((s) => s.tileSet);
  const showAreaLabels = useMapStore((s) => s.showAreaLabels);
  const entries = useProgressStore((s) => s.entries);
  const selectedSlug = useUIStore((s) => s.selectedSlug);

  const maxBounds = useMemo(() => {
    const [[xMin, yMin], [xMax, yMax]] = COVERED_BOUNDS;
    const pad = 2_500;
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
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={90}
      className={className ?? "h-full w-full"}
    >
      <GtaTileLayer tileSet={tileSet} />
      <AreaLabelsLayer sections={sections} districts={districts} visible={showAreaLabels} />
      <MarkerClusterLayer
        locations={locations}
        categoriesBySlug={categoriesBySlug}
        entries={entries}
        selectedSlug={selectedSlug}
      />
      <CustomMarkersLayer />
      <MapController />
      <MapControls />
    </MapContainer>
  );
}
