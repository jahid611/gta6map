"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { ArrowRight, Compass, Crosshair, Grid3x3, Layers, LocateFixed, Minus, Plus, RotateCcw, Ruler, Type } from "@/components/ui/icons";
import { MAP_FILTERS } from "@/lib/map/filters";
import { Select } from "@/components/ui/select";
import { worldToLatLng } from "@/lib/map/coords";
import { useMapStore } from "@/store/useMapStore";
import { LANDMASS_BOUNDS, TILE_SETS, TILE_SET_IDS } from "@/lib/map/config";
import { latLngToWorld } from "@/lib/map/coords";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// 44 px au doigt, 40 px à la souris : sur mobile la colonne est la seule façon
// d'atteindre ces réglages, elle ne peut pas être plus petite que le seuil
// tactile confortable.
const btn =
  "grid h-11 w-11 sm:h-10 sm:w-10 place-items-center text-foreground hover:bg-surface-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 first:rounded-t-2xl last:rounded-b-2xl border-b border-border last:border-b-0";

/** Contrôles custom (zoom, reset, fond de carte, étiquettes) + coordonnées sous le curseur. */
export function MapControls() {
  const map = useMap();
  const tileSet = useMapStore((s) => s.tileSet);
  const setTileSet = useMapStore((s) => s.setTileSet);
  const showAreaLabels = useMapStore((s) => s.showAreaLabels);
  const toggleAreaLabels = useMapStore((s) => s.toggleAreaLabels);
  const showGrid = useMapStore((s) => s.showGrid);
  const toggleGrid = useMapStore((s) => s.toggleGrid);
  const mapFilter = useMapStore((s) => s.mapFilter);
  const setMapFilter = useMapStore((s) => s.setMapFilter);
  const unit = useMapStore((s) => s.unit);
  const setUnit = useMapStore((s) => s.setUnit);
  const measuring = useMapStore((s) => s.measuring);
  const toggleMeasuring = useMapStore((s) => s.toggleMeasuring);
  const realWorld = useMapStore((s) => s.realWorld);
  const toggleRealWorld = useMapStore((s) => s.toggleRealWorld);
  const [layersOpen, setLayersOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoX, setGotoX] = useState("");
  const [gotoY, setGotoY] = useState("");
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  /** Dernière position connue de la souris, en pixels du conteneur. */
  const lastPoint = useRef<L.Point | null>(null);

  const goToCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const x = Number(gotoX.replace(",", "."));
    const y = Number(gotoY.replace(",", "."));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    // `worldToLatLng` renvoie un tuple readonly ; Leaflet attend un tableau
    // mutable, d'où la copie.
    const [lat, lng] = worldToLatLng(x, y);
    map.flyTo([lat, lng], Math.max(map.getZoom(), 5), { duration: 0.9 });
    setGotoOpen(false);
  };

  // Le relevé suit la position du curseur DANS le conteneur, et non la dernière
  // coordonnée lue : après un vol, la carte a défilé sous une souris immobile et
  // l'affichage restait figé sur le point d'avant.
  useEffect(() => {
    const show = (point: L.Point) => {
      const latlng = map.containerPointToLatLng(point);
      const [x, y] = latLngToWorld(latlng.lat, latlng.lng);
      setCursor([Math.round(x), Math.round(y)]);
    };
    const onMove = (e: L.LeafletMouseEvent) => {
      lastPoint.current = e.containerPoint;
      show(e.containerPoint);
    };
    const onOut = () => {
      lastPoint.current = null;
      setCursor(null);
    };
    const onMapMove = () => {
      if (lastPoint.current) show(lastPoint.current);
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    map.on("move", onMapMove);
    map.on("zoom", onMapMove);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      map.off("move", onMapMove);
      map.off("zoom", onMapMove);
    };
  }, [map]);

  // Ces contrôles vivent dans le pane Leaflet de la carte du jeu (z-index 1000),
  // donc au-dessus de la vue réelle (superposition à 500) : ils recouvraient ses
  // boutons + / − tout en pilotant une carte cachée derrière. On les retire tant
  // que la vue réelle est ouverte — elle a les siens.
  if (realWorld) return null;

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
                onClick={() => {
                  // Même cadrage qu'à l'ouverture : les terres centrées dans le
                  // conteneur, plutôt qu'un centre/zoom fixe.
                  const [[xMin, yMin], [xMax, yMax]] = LANDMASS_BOUNDS;
                  map.flyToBounds(L.latLngBounds([yMin, xMin], [yMax, xMax]), { padding: [24, 24] });
                }}
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
                className={cn(btn, showGrid && "text-accent-2")}
                onClick={toggleGrid}
                aria-label="Quadrillage de repérage"
                aria-pressed={showGrid}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Quadrillage (A1, E3…)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(btn, realWorld && "text-accent-2")}
                onClick={toggleRealWorld}
                aria-label="Basculer sur le monde réel"
                aria-pressed={realWorld}
              >
                <Compass className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Voir la zone dans le monde réel</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(btn, measuring && "text-accent-2")}
                onClick={toggleMeasuring}
                aria-label="Mesurer une distance"
                aria-pressed={measuring}
              >
                <Ruler className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Mesurer — clic pour poser, clic droit pour annuler</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(btn, gotoOpen && "bg-surface-3 text-accent")}
                onClick={() => setGotoOpen((v) => !v)}
                aria-label="Aller à des coordonnées"
                aria-expanded={gotoOpen}
              >
                <LocateFixed className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Aller à des coordonnées</TooltipContent>
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

        {gotoOpen && (
          <form
            onSubmit={goToCoords}
            className="leaflet-control rs-glass pointer-events-auto ml-3 mt-2 w-56 rounded-2xl p-3 animate-fade-in"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Aller à</p>
            <div className="flex items-center gap-2">
              {([["X", gotoX, setGotoX], ["Y", gotoY, setGotoY]] as const).map(([axis, value, setValue]) => (
                <label key={axis} className="flex flex-1 items-center gap-1.5">
                  <span className="vi-num text-[11px] text-muted-2">{axis}</span>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Coordonnée ${axis}`}
                    className="w-full min-w-0 rounded-md border border-border bg-surface-2 px-2 py-1 vi-num text-xs  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2"
                  />
                </label>
              ))}
              <button
                type="submit"
                aria-label="Y aller"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-background transition-transform hover:scale-105"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-2">Coordonnées monde en mètres, comme sous le curseur.</p>
          </form>
        )}

        {layersOpen && (
          <div className="leaflet-control rs-glass pointer-events-auto ml-3 mt-2 w-60 rounded-2xl p-3 text-sm animate-fade-in">
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

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Rendu</p>
            <Select
              label="Rendu"
              value={mapFilter}
              onChange={setMapFilter}
              options={MAP_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
            />

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Unités</p>
            <div className="flex gap-1.5">
              {(["km", "mi"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] transition-colors",
                    unit === u
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-border text-muted hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {u === "km" ? "Kilomètres" : "Miles"}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[10px] text-muted-2">Tuiles communautaires via gtadb.org</p>
          </div>
        )}
      </div>

      <div className="leaflet-bottom leaflet-left pointer-events-none hidden md:block">
        <div className="leaflet-control mb-2 ml-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 vi-num text-[11px] text-muted backdrop-blur">
          <Crosshair className="h-3 w-3" />
          {cursor ? `${cursor[0]}, ${cursor[1]}` : "—"}
        </div>
      </div>
    </>
  );
}
