"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { Crosshair, Layers, Minus, Plus, RotateCcw, Type } from "lucide-react";
import { useMapStore } from "@/store/useMapStore";
import { DEFAULT_VIEW, TILE_SETS, TILE_SET_IDS } from "@/lib/map/config";
import { latLngToWorld } from "@/lib/map/coords";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const btn =
  "grid h-10 w-10 place-items-center text-foreground hover:bg-surface-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 first:rounded-t-2xl last:rounded-b-2xl border-b border-border last:border-b-0";

/** Contrôles custom (zoom, reset, fond de carte, étiquettes) + coordonnées sous le curseur. */
export function MapControls() {
  const map = useMap();
  const tileSet = useMapStore((s) => s.tileSet);
  const setTileSet = useMapStore((s) => s.setTileSet);
  const showAreaLabels = useMapStore((s) => s.showAreaLabels);
  const toggleAreaLabels = useMapStore((s) => s.toggleAreaLabels);
  const [layersOpen, setLayersOpen] = useState(false);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  useEffect(() => {
    const onMove = (e: L.LeafletMouseEvent) => {
      const [x, y] = latLngToWorld(e.latlng.lat, e.latlng.lng);
      setCursor([Math.round(x), Math.round(y)]);
    };
    const onOut = () => setCursor(null);
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, [map]);

  return (
    <>
      <div className="leaflet-top leaflet-left pointer-events-none">
        <div className="leaflet-control rs-glass pointer-events-auto mt-3 ml-3 flex flex-col rounded-2xl">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={btn} onClick={() => map.zoomIn()} aria-label="Zoom avant">
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom avant</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={btn} onClick={() => map.zoomOut()} aria-label="Zoom arrière">
                <Minus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom arrière</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={btn}
                onClick={() => map.flyTo([DEFAULT_VIEW.center[1], DEFAULT_VIEW.center[0]], DEFAULT_VIEW.zoom)}
                aria-label="Réinitialiser la vue"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Vue par défaut</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(btn, showAreaLabels && "text-accent-2")}
                onClick={toggleAreaLabels}
                aria-label="Étiquettes de zones"
                aria-pressed={showAreaLabels}
              >
                <Type className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Noms des zones</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(btn, layersOpen && "bg-surface-3 text-accent")}
                onClick={() => setLayersOpen((v) => !v)}
                aria-label="Fonds de carte"
                aria-expanded={layersOpen}
              >
                <Layers className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Fond de carte</TooltipContent>
          </Tooltip>
        </div>

        {layersOpen && (
          <div className="leaflet-control rs-glass pointer-events-auto ml-3 mt-2 w-56 rounded-2xl p-3 text-sm animate-fade-in">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Fond de carte</p>
            <div className="space-y-1">
              {TILE_SET_IDS.map((id) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <input
                    type="radio"
                    name="tileset"
                    className="accent-[var(--accent)]"
                    checked={tileSet === id}
                    onChange={() => setTileSet(id)}
                  />
                  <span className="flex-1">{TILE_SETS[id].label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-2">Tuiles communautaires via gtadb.org</p>
          </div>
        )}
      </div>

      <div className="leaflet-bottom leaflet-left pointer-events-none hidden md:block">
        <div className="leaflet-control mb-2 ml-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[11px] text-muted backdrop-blur">
          <Crosshair className="h-3 w-3" />
          {cursor ? `${cursor[0]}, ${cursor[1]}` : "—"}
        </div>
      </div>
    </>
  );
}
