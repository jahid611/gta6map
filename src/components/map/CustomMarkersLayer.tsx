"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useProgressStore } from "@/store/useProgressStore";
import { MARKER_SIZE, markerHtml } from "@/lib/map/icons";
import { worldToLatLng } from "@/lib/map/coords";

/** Marqueurs personnalisés de l'utilisateur (hors clustering, toujours visibles). */
export function CustomMarkersLayer() {
  const map = useMap();
  const customMarkers = useProgressStore((s) => s.customMarkers);
  const removeCustomMarker = useProgressStore((s) => s.removeCustomMarker);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of Object.values(customMarkers)) {
      const marker = L.marker(worldToLatLng(m.x, m.y) as [number, number], {
        icon: L.divIcon({
          html: markerHtml({ color: m.color, icon: m.icon }).replace("gta-marker", "gta-marker gta-marker--custom"),
          className: "gta-marker-wrapper",
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
          popupAnchor: [0, -MARKER_SIZE / 2],
        }),
        title: m.name,
        zIndexOffset: 500,
      });
      const popup = L.DomUtil.create("div", "space-y-2 text-sm");
      const title = L.DomUtil.create("p", "font-semibold", popup);
      title.textContent = m.name;
      if (m.description) {
        const desc = L.DomUtil.create("p", "text-xs text-muted", popup);
        desc.textContent = m.description;
      }
      const coords = L.DomUtil.create("p", "font-mono text-[11px] text-muted", popup);
      coords.textContent = `${m.x}, ${m.y} m`;
      const del = L.DomUtil.create("button", "text-xs text-red-400 hover:underline cursor-pointer", popup);
      del.type = "button";
      del.textContent = "Supprimer";
      del.addEventListener("click", () => {
        removeCustomMarker(m.id);
        map.closePopup();
      });
      marker.bindPopup(popup, { className: "gta-popup", closeButton: false, offset: [0, -4] });
      layer.addLayer(marker);
    }
  }, [customMarkers, map, removeCustomMarker]);

  return null;
}
