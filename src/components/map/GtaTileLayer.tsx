"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { TileSetId } from "@/types/map";
import { BLANK_TILE_URL, COVERED_BOUNDS, MAX_NATIVE_ZOOM, MAX_ZOOM, MIN_NATIVE_ZOOM, TILE_SIZE } from "@/lib/map/config";
import { buildTileUrl } from "@/lib/map/tiles";

/**
 * `L.TileLayer` spécialisé : résout l'URL de chaque tuile via `buildTileUrl`
 * (jeu de tuiles gtadb, nommage `{z},{y},{x}.jpg`). Hors couverture ⇒ tuile
 * vide en data-URI (aucune requête réseau).
 */
class GtaTileLayerImpl extends L.TileLayer {
  private tileSet: TileSetId;

  constructor(tileSet: TileSetId, options: L.TileLayerOptions) {
    super("", options);
    this.tileSet = tileSet;
  }

  override getTileUrl(coords: L.Coords): string {
    return buildTileUrl(this.tileSet, { z: coords.z, x: coords.x, y: coords.y });
  }

  setTileSet(tileSet: TileSetId): void {
    if (this.tileSet === tileSet) return;
    this.tileSet = tileSet;
    this.redraw();
  }
}

export function GtaTileLayer({ tileSet }: { tileSet: TileSetId }) {
  const map = useMap();
  const layerRef = useRef<GtaTileLayerImpl | null>(null);

  useEffect(() => {
    const [[xMin, yMin], [xMax, yMax]] = COVERED_BOUNDS;
    const layer = new GtaTileLayerImpl(tileSet, {
      tileSize: TILE_SIZE,
      minNativeZoom: MIN_NATIVE_ZOOM,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      minZoom: 0,
      maxZoom: MAX_ZOOM,
      noWrap: true,
      bounds: L.latLngBounds([yMin, xMin], [yMax, xMax]),
      errorTileUrl: BLANK_TILE_URL,
      // Fluidité : on précharge large et on met à jour pendant le zoom/pan (pas seulement à l'arrêt).
      keepBuffer: 8,
      updateWhenZooming: true,
      updateWhenIdle: false,
      updateInterval: 100,
      // Pas de `crossOrigin` : maps.gtadb.org n'envoie pas d'en-tête CORS (inutile sans lecture canvas).
      className: "gta-tiles",
      attribution:
        'Carte <a href="https://map.gtadb.org" target="_blank" rel="noopener">gtadb.org</a> (Yanis, Dupzor & contributeurs, Public Domain) · Caméras <a href="https://github.com/rolux/gtamaplib" target="_blank" rel="noopener">gtamaplib</a> · <a href="https://gta.wiki" target="_blank" rel="noopener">GTA Wiki</a> CC BY-NC-SA',
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // Créée une fois ; le changement de source passe par setTileSet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    layerRef.current?.setTileSet(tileSet);
  }, [tileSet]);

  return null;
}
