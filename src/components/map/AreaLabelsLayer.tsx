"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";
import type { MapSection } from "@/types";
import { areaLabelHtml } from "@/lib/map/icons";
import { worldToLatLng } from "@/lib/map/coords";
import { clamp } from "@/lib/utils";

interface AreaLabelsLayerProps {
  sections: readonly MapSection[];
  /** Zones secondaires (quartiers) calculées depuis les lieux : nom → centre. */
  districts: readonly { name: string; x: number; y: number }[];
  visible: boolean;
}

/**
 * Étiquettes de zones façon carte officielle : grand texte blanc contour sombre,
 * taille adaptée au zoom (interpolée en px via `--area-font`).
 */
export function AreaLabelsLayer({ sections, districts, visible }: AreaLabelsLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  const applyZoom = () => {
    const z = map.getZoom();
    const size = clamp(18 + (z - 1) * 14, 16, 84);
    const container = map.getContainer();
    container.style.setProperty("--area-font", `${size}px`);
    // Quartiers visibles seulement à partir du zoom 4
    container.classList.toggle("gta-districts-hidden", z < 3.5);
  };

  useEffect(() => {
    const layer = L.layerGroup();
    for (const s of sections) {
      const [xMin, yMin, xMax, yMax] = s.bounds;
      const [lat, lng] = worldToLatLng((xMin + xMax) / 2, (yMin + yMax) / 2);
      layer.addLayer(
        L.marker([lat, lng], {
          icon: L.divIcon({ html: areaLabelHtml(s.name, 1), className: "gta-area-label-wrapper", iconSize: [0, 0] }),
          interactive: false,
          keyboard: false,
          zIndexOffset: -1000,
        }),
      );
    }
    for (const d of districts) {
      const [lat, lng] = worldToLatLng(d.x, d.y);
      layer.addLayer(
        L.marker([lat, lng], {
          icon: L.divIcon({ html: areaLabelHtml(d.name, 2), className: "gta-area-label-wrapper gta-district-label", iconSize: [0, 0] }),
          interactive: false,
          keyboard: false,
          zIndexOffset: -900,
        }),
      );
    }
    layerRef.current = layer;
    if (visible) layer.addTo(map);
    applyZoom();
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sections, districts]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) layer.addTo(map);
    else layer.remove();
  }, [visible, map]);

  // Uniquement en fin de zoom : recalculer le style à chaque frame d'animation coûte un recalc CSS global.
  useMapEvents({ zoomend: applyZoom });

  return null;
}
