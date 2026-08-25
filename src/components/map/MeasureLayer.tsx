"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { distanceMeters, latLngToWorld, worldToLatLng } from "@/lib/map/coords";
import { useMapStore } from "@/store/useMapStore";
import type { WorldXY } from "@/types/map";

/** Distance lisible : mètres sous le kilomètre, kilomètres au-delà (ou miles). */
export function formatDistance(meters: number, unit: "km" | "mi"): string {
  if (unit === "mi") {
    const miles = meters / 1609.344;
    return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(2)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Règle : chaque clic pose un point, la polyligne cumule les distances.
 *
 * Les longueurs sont calculées en coordonnées monde (mètres RAGE) via
 * `distanceMeters`, pas avec `map.distance()` : le CRS est une projection
 * identité sur un plan, la distance euclidienne y est exacte alors qu'une
 * formule géodésique n'aurait aucun sens sur une carte de jeu.
 *
 * La couche ne se monte que lorsque l'outil est actif ; sa désactivation efface
 * le tracé. C'est volontaire — une règle qu'on range est une règle qu'on a fini
 * d'utiliser, et garder le tracé obligerait à un second geste pour l'effacer.
 */
export function MeasureLayer({ active }: { active: boolean }) {
  const map = useMap();
  const unit = useMapStore((s) => s.unit);
  const pointsRef = useRef<WorldXY[]>([]);

  useEffect(() => {
    if (!active) return;

    const group = L.layerGroup().addTo(map);
    pointsRef.current = [];

    const redraw = () => {
      group.clearLayers();
      const pts = pointsRef.current;
      if (pts.length === 0) return;

      const latlngs = pts.map((p) => {
        const [lat, lng] = worldToLatLng(p[0], p[1]);
        return L.latLng(lat, lng);
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: "#f976b0", weight: 2.5, opacity: 0.95, dashArray: "6 5" }).addTo(group);
      }

      let total = 0;
      pts.forEach((p, i) => {
        if (i > 0) total += distanceMeters(pts[i - 1], p);
        const label =
          i === 0
            ? "Départ"
            : `${formatDistance(total, unit)}${i === pts.length - 1 && pts.length > 2 ? " (total)" : ""}`;
        L.marker(latlngs[i], {
          icon: L.divIcon({
            className: "gta-measure-wrapper",
            html: `<span class="gta-measure"><i></i><b>${label}</b></span>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(group);
      });
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      const [x, y] = latLngToWorld(e.latlng.lat, e.latlng.lng);
      pointsRef.current = [...pointsRef.current, [Math.round(x), Math.round(y)]];
      redraw();
    };

    // Clic droit : retire le dernier point plutôt que d'ouvrir le menu marqueur.
    const onContext = (e: L.LeafletMouseEvent) => {
      if (pointsRef.current.length === 0) return;
      L.DomEvent.stop(e);
      pointsRef.current = pointsRef.current.slice(0, -1);
      redraw();
    };

    map.on("click", onClick);
    map.on("contextmenu", onContext);
    const container = map.getContainer();
    container.style.cursor = "crosshair";

    return () => {
      map.off("click", onClick);
      map.off("contextmenu", onContext);
      container.style.cursor = "";
      group.remove();
      pointsRef.current = [];
    };
  }, [map, active, unit]);

  return null;
}
