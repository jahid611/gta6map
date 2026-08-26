"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { decodeViewHash, encodeViewHash, latLngToWorld, worldToLatLng } from "@/lib/map/coords";
import { DEFAULT_VIEW, LANDMASS_BOUNDS, MAX_ZOOM, MIN_ZOOM } from "@/lib/map/config";
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

  // Vue initiale. Priorité au hash d'URL (compatible gta6map.github.io :
  // #x,y,z), puis à la vue persistée si l'utilisateur en a déjà bougé une.
  //
  // À défaut, on cadre sur les terres avec `fitBounds` plutôt que d'appliquer
  // le centre/zoom fixe de `DEFAULT_VIEW` : celui-ci ignorait la largeur réelle
  // du conteneur (amputée de 340 px par le panneau latéral) et laissait Vice
  // City hors cadre à droite.
  useEffect(() => {
    const parsed = decodeViewHash(window.location.hash);
    if (parsed) {
      map.setView([parsed.center[1], parsed.center[0]], clamp(parsed.zoom, MIN_ZOOM, MAX_ZOOM), { animate: false });
      return;
    }
    const { center, zoom } = useMapStore.getState();
    const untouched = center[0] === DEFAULT_VIEW.center[0] && center[1] === DEFAULT_VIEW.center[1] && zoom === DEFAULT_VIEW.zoom;
    if (!untouched) return;

    const [[xMin, yMin], [xMax, yMax]] = LANDMASS_BOUNDS;
    map.fitBounds(L.latLngBounds([yMin, xMin], [yMax, xMax]), { padding: [24, 24], animate: false });
  }, [map]);

  useEffect(() => {
    if (!flyToRequest) return;
    const [x, y] = flyToRequest.center;
    const zoom = clamp(flyToRequest.zoom ?? Math.max(map.getZoom(), 5), MIN_ZOOM, MAX_ZOOM);

    // La fiche recouvre la partie droite de la carte : centrer sur le conteneur
    // plaçait le point derrière elle, décalé de la moitié de sa largeur. On vise
    // donc le centre de la zone RESTÉE visible.
    const overlay = document.querySelector<HTMLElement>("[data-location-panel]");
    const hidden = overlay ? overlay.getBoundingClientRect().width : 0;
    const target = worldToLatLng(x, y);
    const point = map.project([target[0], target[1]], zoom).add([hidden / 2, 0]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.9, easeLinearity: 0.25 });
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
      // Règle active : le clic pose un point de mesure, il ne doit pas en plus
      // désélectionner le lieu affiché (cf. `MeasureLayer`).
      if (useMapStore.getState().measuring) return;
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest(".gta-marker, .gta-cluster, .leaflet-marker-icon")) return;
      selectLocation(null);
    },
    contextmenu(e: L.LeafletMouseEvent) {
      e.originalEvent.preventDefault();
      // Idem : pendant une mesure, le clic droit retire le dernier point au lieu
      // de proposer un marqueur personnalisé.
      if (useMapStore.getState().measuring) return;
      const [x, y] = latLngToWorld(e.latlng.lat, e.latlng.lng);
      setPendingCustomMarker({ x: Math.round(x), y: Math.round(y) });
    },
  });

  return null;
}
