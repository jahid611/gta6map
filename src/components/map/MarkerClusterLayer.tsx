"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import type { Category, Location } from "@/types";
import type { ProgressEntry } from "@/types/progress";
import { CAMERA_MARKER_SIZE, MARKER_SIZE, clusterHtml, markerHtml } from "@/lib/map/icons";
import { DEFAULT_CATEGORY_SLUG } from "@/lib/data/categories";
import { useUIStore } from "@/store/useUIStore";

interface MarkerClusterLayerProps {
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
  entries: Record<string, ProgressEntry>;
  selectedSlug: string | null;
}

interface ManagedMarker {
  marker: L.Marker;
}

function cameraLabel(location: Location): string {
  const num = location.legacyId.split("/")[1] ?? "";
  if (location.categorySlug === "trailer-1") return `T1·${num}`;
  if (location.categorySlug === "trailer-2") return `T2·${num}`;
  return `S${num}`;
}

function iconFor(location: Location, category: Category | undefined, found: boolean, selected: boolean): L.DivIcon {
  const isCamera = location.kind === "camera";
  const size = isCamera ? CAMERA_MARKER_SIZE : MARKER_SIZE;
  return L.divIcon({
    html: markerHtml({
      color: category?.color ?? location.color,
      icon: category?.icon ?? (isCamera ? "Camera" : "MapPin"),
      found,
      selected,
      camera: isCamera ? { label: cameraLabel(location), yaw: location.media?.yaw ?? 0 } : null,
    }),
    className: "gta-marker-wrapper",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Couche de marqueurs clusterisés (leaflet.markercluster).
 *
 * Performance :
 *  - marqueurs créés une seule fois par lieu et réutilisés (Map id → L.Marker)
 *  - ajout/suppression par lot (`addLayers` / `removeLayers`) avec `chunkedLoading`
 *  - `setIcon` uniquement quand l'état visuel (trouvé / sélectionné) change
 *  - clustering désactivé aux zooms élevés (`disableClusteringAtZoom`)
 */
export function MarkerClusterLayer({ locations, categoriesBySlug, entries, selectedSlug }: MarkerClusterLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, ManagedMarker>>(new Map());
  /** Clé d'état visuel (`found|selected`) par lieu — évite les `setIcon` inutiles. */
  const stateKeysRef = useRef<Map<string, string>>(new Map());
  const locationByIdRef = useRef<Map<string, Location>>(new Map());
  const selectLocation = useUIStore((s) => s.selectLocation);
  const setHovered = useUIStore((s) => s.setHovered);

  // ── Création du groupe ──
  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 20,
      maxClusterRadius: (zoom: number) => (zoom >= 6 ? 30 : zoom >= 4 ? 45 : 60),
      disableClusteringAtZoom: 7,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      iconCreateFunction: (cluster) => {
        const children = cluster.getAllChildMarkers();
        const colorCount = new Map<string, number>();
        for (const child of children) {
          const color = (child.options as { gtaColor?: string }).gtaColor ?? "#94a3b8";
          colorCount.set(color, (colorCount.get(color) ?? 0) + 1);
        }
        let dominant = "#94a3b8";
        let best = -1;
        for (const [color, n] of colorCount) {
          if (n > best) {
            best = n;
            dominant = color;
          }
        }
        const count = cluster.getChildCount();
        const size = count < 10 ? 34 : count < 50 ? 42 : 52;
        return L.divIcon({
          html: clusterHtml(count, dominant),
          className: "gta-cluster-wrapper",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });
    group.addTo(map);
    groupRef.current = group;
    const managed = markersRef.current;
    const stateKeys = stateKeysRef.current;
    return () => {
      group.clearLayers();
      group.remove();
      groupRef.current = null;
      managed.clear();
      stateKeys.clear();
    };
  }, [map]);

  // ── Synchronisation de l'ensemble des marqueurs affichés ──
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const managed = markersRef.current;
    const nextIds = new Set<string>();
    const toAdd: L.Marker[] = [];

    for (const location of locations) {
      nextIds.add(location.id);
      locationByIdRef.current.set(location.id, location);
      if (managed.has(location.id)) continue;
      const category = categoriesBySlug.get(location.categorySlug) ?? categoriesBySlug.get(DEFAULT_CATEGORY_SLUG);
      const found = entries[location.id]?.found ?? false;
      const selected = location.slug === selectedSlug;
      const marker = L.marker(location.latLng as [number, number], {
        icon: iconFor(location, category, found, selected),
        title: location.name,
        alt: location.name,
        keyboard: false,
        riseOnHover: true,
        // Propriétés custom lues par iconCreateFunction (couleur dominante du cluster).
        ...({ gtaColor: category?.color ?? location.color, gtaSlug: location.slug } as object),
      });
      marker.on("click", () => selectLocation(location.slug));
      marker.on("mouseover", () => setHovered(location.slug));
      marker.on("mouseout", () => setHovered(null));
      managed.set(location.id, { marker });
      stateKeysRef.current.set(location.id, `${found}|${selected}`);
      toAdd.push(marker);
    }

    const toRemove: L.Marker[] = [];
    for (const [id, m] of managed) {
      if (!nextIds.has(id)) {
        toRemove.push(m.marker);
        managed.delete(id);
        stateKeysRef.current.delete(id);
      }
    }

    if (toRemove.length) group.removeLayers(toRemove);
    if (toAdd.length) group.addLayers(toAdd);
    // `entries` / `selectedSlug` sont gérés par l'effet suivant (mise à jour incrémentale).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, categoriesBySlug]);

  // ── Mise à jour incrémentale des icônes (trouvé / sélectionné) ──
  useEffect(() => {
    const managed = markersRef.current;
    const stateKeys = stateKeysRef.current;
    for (const [id, m] of managed) {
      const location = locationByIdRef.current.get(id);
      if (!location) continue;
      const found = entries[id]?.found ?? false;
      const selected = location.slug === selectedSlug;
      const key = `${found}|${selected}`;
      if (key === stateKeys.get(id)) continue;
      const category = categoriesBySlug.get(location.categorySlug) ?? categoriesBySlug.get(DEFAULT_CATEGORY_SLUG);
      m.marker.setIcon(iconFor(location, category, found, selected));
      m.marker.setZIndexOffset(selected ? 1000 : 0);
      stateKeys.set(id, key);
    }
  }, [entries, selectedSlug, categoriesBySlug]);

  return null;
}
