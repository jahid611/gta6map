"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { GRID_CELL_METERS, GRID_ORIGIN, TILE_SIZE } from "@/lib/map/config";
import { gridRef } from "@/lib/map/grid";

/**
 * Quadrillage de repérage optionnel (A1, E3, G8…).
 *
 * Implémenté en `L.GridLayer` : Leaflet ne demande que les tuiles visibles et
 * gère lui-même le pan / zoom / recyclage. Un dessin en SVG plein écran serait
 * à repositionner à chaque `move`, et un `L.Polyline` par ligne créerait des
 * centaines de nœuds DOM pour un simple décor.
 *
 * Chaque tuile est un canvas 256 px : on y trace les lignes de la grille qui la
 * traversent, plus le libellé de toute cellule dont le coin haut-gauche y tombe
 * (donc exactement une fois par cellule, sans dédoublonnage à gérer).
 */
class CoordinateGridImpl extends L.GridLayer {
  override createTile(coords: L.Coords): HTMLElement {
    const canvas = document.createElement("canvas");
    const size = this.getTileSize();
    // Rendu net sur écran HiDPI : on dessine à l'échelle du device.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.scale(dpr, dpr);

    const map = this._map;
    const z = coords.z;
    // Coin haut-gauche de la tuile, en pixels projetés du CRS.
    const originX = coords.x * size.x;
    const originY = coords.y * size.y;

    /** Monde (m) → pixel local à la tuile. */
    const toLocal = (worldX: number, worldY: number) => {
      const p = map.project(L.latLng(worldY, worldX), z);
      return { x: p.x - originX, y: p.y - originY };
    };

    // Bornes monde de la tuile (y décroît quand py croît).
    const topLeft = map.unproject(L.point(originX, originY), z);
    const bottomRight = map.unproject(L.point(originX + size.x, originY + size.y), z);
    const xMin = topLeft.lng;
    const xMax = bottomRight.lng;
    const yMin = bottomRight.lat;
    const yMax = topLeft.lat;

    const cell = GRID_CELL_METERS;
    const [ox, oy] = GRID_ORIGIN;
    const colFrom = Math.floor((xMin - ox) / cell);
    const colTo = Math.ceil((xMax - ox) / cell);
    const rowFrom = Math.floor((oy - yMax) / cell);
    const rowTo = Math.ceil((oy - yMin) / cell);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let c = colFrom; c <= colTo; c++) {
      // +0.5 : cale le trait sur la grille de pixels, sinon il rend flou sur 2 px.
      const x = Math.round(toLocal(ox + c * cell, yMax).x) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.y);
    }
    for (let r = rowFrom; r <= rowTo; r++) {
      const y = Math.round(toLocal(xMin, oy - r * cell).y) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(size.x, y);
    }
    ctx.stroke();

    // Libellés — inutiles quand les cellules deviennent minuscules à l'écran.
    const cellPx = toLocal(ox + cell, 0).x - toLocal(ox, 0).x;
    if (cellPx >= 46) {
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
      ctx.textBaseline = "top";
      for (let c = colFrom; c <= colTo; c++) {
        for (let r = rowFrom; r <= rowTo; r++) {
          const label = gridRef(c, r);
          if (!label) continue;
          const { x, y } = toLocal(ox + c * cell, oy - r * cell);
          ctx.fillText(label, x + 5, y + 4);
        }
      }
    }

    return canvas;
  }
}

export function CoordinateGridLayer({ visible }: { visible: boolean }) {
  const map = useMap();
  const layerRef = useRef<CoordinateGridImpl | null>(null);

  useEffect(() => {
    if (!visible) return;
    const layer = new CoordinateGridImpl({ tileSize: TILE_SIZE, pane: "overlayPane", className: "gta-grid" });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, visible]);

  return null;
}
