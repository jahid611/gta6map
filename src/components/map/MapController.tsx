"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { decodeViewHash, encodeViewHash, latLngToWorld } from "@/lib/map/coords";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/map/config";
import { clamp } from "@/lib/utils";

/**
 * Pont entre Leaflet et les stores :
 *  - consomme les demandes `flyTo` (recherche, sélection, deep link)
 *  - reporte la vue courante dans `useMapStore` + hash d'URL `#x,y,z` (throttle)
 *  - clic droit / appui long ⇒ point en attente pour un marqueur personnalisé
 *  - clic sur la carte (hors marqueur) ⇒ désélection
 */
export function MapController() {
  const map = useMap();
  const flyToRequest = useMapStore((s) => s.flyToRequest);
  const consumeFlyTo = useMapStore((s) => s.consumeFlyTo);
  const setView = useMapStore((s) => s.setView);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const setPendingCustomMarker = useUIStore((s) => s.setPendingCustomMarker);
  const hashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vue initiale depuis le hash (compatible gta6map.github.io : #x,y,z)
  useEffect(() => {
    const parsed = decodeViewHash(window.location.hash);
    if (parsed) {
      map.setView([parsed.center[1], parsed.center[0]], clamp(parsed.zoom, MIN_ZOOM, MAX_ZOOM), { animate: false });
    }
  }, [map]);

  useEffect(() => {
    if (!flyToRequest) return;
    const [x, y] = flyToRequest.center;
    const zoom = flyToRequest.zoom ?? Math.max(map.getZoom(), 5);
    map.flyTo([y, x], clamp(zoom, MIN_ZOOM, MAX_ZOOM), { duration: 0.9, easeLinearity: 0.25 });
    consumeFlyTo();
  }, [flyToRequest, map, consumeFlyTo]);

  useMapEvents({
    moveend() {
      const c = map.getCenter();
      const zoom = map.getZoom();
      const world = latLngToWorld(c.lat, c.lng);
      setView(world, zoom);
      if (hashTimer.current) clearTimeout(hashTimer.current);
      hashTimer.current = setTimeout(() => {
        const hash = `#${encodeViewHash(world, zoom)}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
        }
      }, 250);
    },
    click(e: L.LeafletMouseEvent) {
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest(".gta-marker, .gta-cluster, .leaflet-marker-icon")) return;
      selectLocation(null);
    },
    contextmenu(e: L.LeafletMouseEvent) {
      e.originalEvent.preventDefault();
      const [x, y] = latLngToWorld(e.latlng.lat, e.latlng.lng);
      setPendingCustomMarker({ x: Math.round(x), y: Math.round(y) });
    },
  });

  return null;
}
